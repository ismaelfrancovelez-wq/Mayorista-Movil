// app/api/payments/qr/status/route.ts
// Polling de estado de pago QR.
// El frontend llama cada 3s hasta que el pago se confirma.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { getMerchantOrdersByReference } from "../../../../lib/mercadopago-qr";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = cookies().get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const reservationId = searchParams.get("reservationId");

  if (!reservationId) {
    return NextResponse.json({ error: "Falta reservationId" }, { status: 400 });
  }

  const resSnap = await db.collection("reservations").doc(reservationId).get();
  if (!resSnap.exists || resSnap.data()?.retailerId !== userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Primero chequeamos Firestore — el webhook puede haberlo procesado ya
  if (resSnap.data()?.status === "paid") {
    return NextResponse.json({ paid: true, status: "paid" });
  }

  // Si no, consultamos MP directamente como fallback
  try {
    const orders = await getMerchantOrdersByReference(reservationId);
    const paidOrder = orders.find(
      (o) =>
        o.order_status === "paid" ||
        o.payments.some((p) => p.status === "approved")
    );
    return NextResponse.json({
      paid:   !!paidOrder,
      status: paidOrder ? "paid" : "pending",
    });
  } catch {
    return NextResponse.json({ paid: false, status: "pending" });
  }
}