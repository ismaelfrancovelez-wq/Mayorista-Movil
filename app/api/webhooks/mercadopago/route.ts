import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { addFraccionadoToLot, FraccionatedLot } from "../../../../lib/lots";
import { createOrderFromClosedLot } from "../../../../lib/orders";

export async function POST(req: Request) {
  console.log("🔥 WEBHOOK RECIBIDO");

  try {
    /* ===============================
       1️⃣ LEER PARÁMETROS
    =============================== */
    const url = new URL(req.url);

    const paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");

    const topic =
      url.searchParams.get("type") ||
      url.searchParams.get("topic");

    if (!paymentId || topic !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentRef = db.collection("payments").doc(paymentId.toString());

    /* ===============================
       2️⃣ LOCK ABSOLUTO POR PAGO (CLAVE)
       🔒 SI YA FUE APLICADO → SALIR
    =============================== */
    const locked = await db.runTransaction(async (tx) => {
      const snap = await tx.get(paymentRef);

      if (snap.exists && snap.data()?.appliedToLot === true) {
        return true;
      }

      tx.set(
        paymentRef,
        {
          processing: true,
          appliedToLot: true, // 🔒 SE BLOQUEA ACÁ (ANTES DE TODO)
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return false;
    });

    if (locked) {
      console.log("⏭️ Pago ya aplicado al lote:", paymentId);
      return NextResponse.json({ received: true });
    }

    /* ===============================
       3️⃣ OBTENER PAGO REAL DE MP
    =============================== */
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: paymentId });

    console.log("💰 PAYMENT STATUS:", payment.status);

    if (payment.status !== "approved") {
      return NextResponse.json({ received: true });
    }

    /* ===============================
       4️⃣ NORMALIZAR METADATA
    =============================== */
    const m = payment.metadata || {};

    const orderType = m.orderType || m.order_type;
    const productId = m.productId || m.product_id;
    const retailerId = m.retailerId || m.retailer_id || "";

    const qty = Number(m.original_qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      console.error("❌ original_qty inválido:", m.original_qty);
      return NextResponse.json({ received: true });
    }

    const MF = Number(m.MF || m.mf || 0);
    const lotType = m.lotType || m.lot_type || null;

    if (!orderType || !productId) {
      console.error("❌ Metadata inválida:", m);
      return NextResponse.json({ received: true });
    }

    /* ===============================
       5️⃣ RESOLVER FÁBRICA
    =============================== */
    const productSnap = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!productSnap.exists) {
      console.error("❌ Producto no encontrado:", productId);
      return NextResponse.json({ received: true });
    }

    const factoryId = productSnap.data()!.factoryId;
    if (!factoryId) {
      console.error("❌ Producto sin factoryId:", productId);
      return NextResponse.json({ received: true });
    }

    /* ===============================
       6️⃣ GUARDAR PAGO (SIN DUPLICAR)
    =============================== */
    await paymentRef.set(
      {
        status: payment.status,
        orderType,
        isFraccionado: orderType === "fraccionado",
        productId,
        retailerId,
        factoryId,
        qty,
        MF,
        lotType,

        // 🔑 MODELO DE NEGOCIO
        settled: orderType !== "fraccionado",
        refundable: orderType === "fraccionado",

        updatedAt: FieldValue.serverTimestamp(),
        raw: payment,
      },
      { merge: true }
    );

    console.log("✅ PAGO REGISTRADO:", paymentId);

    /* ===============================
       7️⃣ FLUJO FRACCIONADO
       ⚠️ SOLO SE EJECUTA UNA VEZ
    =============================== */
    if (orderType === "fraccionado" && lotType) {
      await addFraccionadoToLot({
        productId,
        factoryId,
        MF,
        lotType,
        retailerOrder: {
          retailerId,
          qty,
          paymentId: paymentId.toString(),
        },
      });

      /* ===============================
         8️⃣ SI EL LOTE SE CERRÓ → ORDEN FINAL
      =============================== */
      const closedLotSnap = await db
        .collection("lots")
        .where("productId", "==", productId)
        .where("factoryId", "==", factoryId)
        .where("type", "==", lotType)
        .where("status", "==", "closed")
        .where("orderCreated", "==", false)
        .limit(1)
        .get();

      if (!closedLotSnap.empty) {
        const doc = closedLotSnap.docs[0];

        await createOrderFromClosedLot({
          ...(doc.data() as FraccionatedLot),
          id: doc.id,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
    return NextResponse.json({ received: true });
  }
}