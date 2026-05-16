// app/api/reservations/cancel/route.ts
//
// ✅ REFACTOR (Fase 1):
// - Eliminado el bloque 8 que actualizaba la racha del retailer al cancelar.
// - Ya no se importa updateRetailerScoreIncremental (gamificación retirada).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ── 1. AUTH ──────────────────────────────────────────────────────────
    const userId = cookies().get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // ── 2. BODY ──────────────────────────────────────────────────────────
    const { reservationId } = await req.json();
    if (!reservationId) {
      return NextResponse.json({ error: "reservationId requerido" }, { status: 400 });
    }

    // ── 3. LEER RESERVA ──────────────────────────────────────────────────
    const resRef = db.collection("reservations").doc(reservationId);
    const resSnap = await resRef.get();

    if (!resSnap.exists) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const reservation = resSnap.data()!;

    // ── 4. VERIFICAR QUE ES DEL USUARIO ──────────────────────────────────
    if (reservation.retailerId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // ── 5. VERIFICAR ESTADO (REGLA DE NEGOCIO) ────────────────────────────
    if (reservation.status !== "pending_lot") {
      return NextResponse.json(
        {
          error:
            reservation.status === "lot_closed" || reservation.status === "paid"
              ? "No es posible cancelar una vez que el lote alcanzó el mínimo. El compromiso con los demás compradores es firme."
              : "Esta reserva no se puede cancelar en su estado actual.",
          code: "CANNOT_CANCEL_AFTER_LOT_CLOSED",
        },
        { status: 409 }
      );
    }

    // ── 6. CANCELAR RESERVA ───────────────────────────────────────────────
    await resRef.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ── 7. ACTUALIZAR EL LOTE (restar qty) ───────────────────────────────
    if (reservation.lotId) {
      const lotRef = db.collection("lots").doc(reservation.lotId);
      const lotSnap = await lotRef.get();

      if (lotSnap.exists) {
        const lot = lotSnap.data()!;
        const newQty = Math.max((lot.accumulatedQty || 0) - (reservation.qty || 0), 0);

        if (newQty === 0) {
          await lotRef.delete();
          console.log(`🗑️ Lote ${reservation.lotId} eliminado (sin reservas activas)`);
        } else {
          await lotRef.update({
            accumulatedQty: newQty,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`✅ Lote ${reservation.lotId} actualizado: ${lot.accumulatedQty} → ${newQty}`);
        }
      }
    }

    console.log(`✅ Reserva ${reservationId} cancelada por usuario ${userId}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ Error cancelando reserva:", error);
    return NextResponse.json(
      { error: "Error al cancelar la reserva. Intentá de nuevo." },
      { status: 500 }
    );
  }
}