import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { addFraccionadoToLot } from "@/lib/lots";
import { FraccionatedLot } from "@/lib/lots";
import { createOrderFromClosedLot } from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🔒 SOLO pagos
    if (body.type !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: paymentId });

    // 🔒 SOLO pagos aprobados
    if (payment.status !== "approved") {
      console.log("⏳ Pago no aprobado, ignorado:", paymentId);
      return NextResponse.json({ received: true });
    }

    // 🔒 IDEMPOTENCIA: si ya existe, NO volver a procesar
    const paymentRef = db.collection("payments").doc(paymentId.toString());
    const paymentSnap = await paymentRef.get();

    if (paymentSnap.exists) {
      console.log("⚠️ Payment ya procesado, ignorado:", paymentId);
      return NextResponse.json({ received: true });
    }

    const metadata = payment.metadata || {};

    // 🔒 Validaciones críticas
    if (
      metadata.order_type !== "fraccionado" ||
      !metadata.product_id ||
      !metadata.factory_id ||
      !metadata.retailer_id ||
      !metadata.qty ||
      !metadata.mf
    ) {
      console.warn("⚠️ Metadata incompleta, ignorado:", metadata);
      return NextResponse.json({ received: true });
    }

    console.log("✅ PAYMENT METADATA:", metadata);

    // 🧾 Guardamos pago (AUDITORÍA PRIMERO)
    await paymentRef.set({
      status: payment.status,
      orderType: metadata.order_type,
      productId: metadata.product_id,
      retailerId: metadata.retailer_id,
      factoryId: metadata.factory_id,
      qty: metadata.qty,
      MF: metadata.mf,
      shippingCost: metadata.shipping ?? 0,
      totalAmount: payment.transaction_amount,
      createdAt: FieldValue.serverTimestamp(),
      raw: payment,
    });

    // ➕ SUMAMOS AL LOTE
    await addFraccionadoToLot({
      productId: metadata.product_id,
      factoryId: metadata.factory_id,
      MF: metadata.mf,
      retailerOrder: {
        retailerId: metadata.retailer_id,
        qty: metadata.qty,
        paymentId: paymentId.toString(),
      },
    });

    // 🔍 Verificamos si el lote se cerró
    const lotSnap = await db
      .collection("lots")
      .doc(metadata.product_id)
      .get();

    if (lotSnap.exists) {
      const lot = lotSnap.data() as FraccionatedLot;

      if (lot.status === "closed") {
        await createOrderFromClosedLot(lot);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    return NextResponse.json({ received: true });
  }
}