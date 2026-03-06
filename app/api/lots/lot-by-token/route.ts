// app/api/lots/lot-by-token/route.ts
// GET ?token=XXX → devuelve info básica del lote para la página de confirmación

import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const snap = await db
    .collection("lots")
    .where("confirmationToken", "==", token)
    .where("status", "==", "awaiting_seller_confirmation")
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "Token inválido o lote ya procesado" }, { status: 404 });
  }

  const doc = snap.docs[0];
  const data = doc.data();

  // Contar compradores (reservas pending_lot)
  const reservationsSnap = await db
    .collection("reservations")
    .where("lotId", "==", doc.id)
    .where("status", "==", "pending_lot")
    .get();

  return NextResponse.json({
    lotId: doc.id,
    productName: data.productName || "Producto",
    accumulatedQty: data.accumulatedQty || 0,
    buyerCount: reservationsSnap.size,
    confirmationDeadlineAt: data.confirmationDeadlineAt?.toDate?.()?.toISOString() ?? null,
  });
}