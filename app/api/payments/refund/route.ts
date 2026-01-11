import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId requerido" },
        { status: 400 }
      );
    }

    /* ===============================
       1️⃣ OBTENER PAGO
    =============================== */
    const paymentRef = db.collection("payments").doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 }
      );
    }

    const paymentData = paymentSnap.data()!;

    /* ===============================
       2️⃣ VALIDACIONES DE NEGOCIO
    =============================== */

    // 🔒 Solo fraccionados
    if (!paymentData.isFraccionado) {
      return NextResponse.json(
        { error: "Solo pedidos fraccionados pueden reembolsarse" },
        { status: 400 }
      );
    }

    // 🔒 Ya reembolsado
    if (paymentData.refunded === true) {
      return NextResponse.json(
        { error: "Pago ya fue reembolsado" },
        { status: 400 }
      );
    }

    // 🔒 Ya liquidado
    if (paymentData.settled === true) {
      return NextResponse.json(
        { error: "Lote cerrado, no se puede reembolsar" },
        { status: 400 }
      );
    }

    /* ===============================
       3️⃣ VALIDAR ESTADO DEL LOTE
       👉 SOLO accumulating
    =============================== */
    const lotQuery = await db
      .collection("lots")
      .where("productId", "==", paymentData.productId)
      .where("factoryId", "==", paymentData.factoryId)
      .where("type", "==", paymentData.lotType)
      .limit(1)
      .get();

    if (lotQuery.empty) {
      return NextResponse.json(
        { error: "Lote no encontrado" },
        { status: 400 }
      );
    }

    const lotSnap = lotQuery.docs[0];
    const lot = lotSnap.data();

    if (lot.status !== "accumulating") {
      return NextResponse.json(
        { error: "El lote ya se cerró, no se puede reembolsar" },
        { status: 400 }
      );
    }

    /* ===============================
       4️⃣ REEMBOLSO EN MERCADOPAGO
    =============================== */
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const paymentApi = new Payment(client);

    // ⚠️ cancel() es correcto para pagos aún no liquidados
    await paymentApi.cancel({ id: paymentId });

    /* ===============================
       5️⃣ TRANSACCIÓN FIRESTORE
       - Descontar del lote
       - Eliminar orden
       - Marcar pago reembolsado
    =============================== */
    await db.runTransaction(async (tx) => {
      const freshLotSnap = await tx.get(lotSnap.ref);
      if (!freshLotSnap.exists) return;

      const freshLot = freshLotSnap.data()!;
      const currentQty = Number(freshLot.accumulatedQty || 0);
      const refundQty = Number(paymentData.qty || 0);

      const newQty = Math.max(0, currentQty - refundQty);

      tx.update(freshLotSnap.ref, {
        accumulatedQty: newQty,
        orders: (freshLot.orders || []).filter(
          (o: any) => o.paymentId !== paymentId
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.update(paymentRef, {
        refunded: true,
        refundable: false,
        appliedToLot: false,
        refundedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ REFUND ERROR:", err);
    return NextResponse.json(
      { error: "Error al reembolsar" },
      { status: 500 }
    );
  }
}