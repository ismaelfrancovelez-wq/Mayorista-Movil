// app/api/lots/confirm-stock/route.ts
//
// GET  ?token=XXX  → página de confirmación (redirige al dashboard)
// POST { token, action: "confirm" | "cancel" } → confirma o cancela el lote
//
// FLUJO:
//   1. Lote cierra → status "awaiting_seller_confirmation" + confirmationToken + confirmationDeadlineAt (12hs)
//   2. Email al vendedor con botón "Confirmar stock" y botón "No tengo stock"
//   3. Si confirma → cron procesa el lote normalmente (manda links de pago a compradores)
//   4. Si cancela o vence 12hs sin respuesta → lote cancelado, email a compradores

import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmail } from "../../../../lib/email/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, action } = body;

    if (!token || !["confirm", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    // Buscar el lote por token
    const lotSnap = await db
      .collection("lots")
      .where("confirmationToken", "==", token)
      .where("status", "==", "awaiting_seller_confirmation")
      .limit(1)
      .get();

    if (lotSnap.empty) {
      return NextResponse.json(
        { error: "Token inválido o lote ya procesado" },
        { status: 404 }
      );
    }

    const lotDoc = lotSnap.docs[0];
    const lotData = lotDoc.data();
    const lotId = lotDoc.id;

    // Verificar que no venció el plazo
    const deadline = lotData.confirmationDeadlineAt?.toDate?.() ?? new Date(0);
    if (new Date() > deadline) {
      return NextResponse.json(
        { error: "El plazo de confirmación venció. El lote fue cancelado automáticamente." },
        { status: 410 }
      );
    }

    if (action === "confirm") {
      // ✅ Vendedor confirma stock → pasar a "closed" para que el cron lo procese
      await db.collection("lots").doc(lotId).update({
        status: "closed",
        sellerConfirmedAt: FieldValue.serverTimestamp(),
        sellerConfirmed: true,
        // Ventana de 2h para Nivel 1 (igual que el flujo normal)
        level1WindowExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Vendedor confirmó stock para lote ${lotId}`);

      return NextResponse.json({
        success: true,
        message: "Stock confirmado. Los compradores recibirán sus links de pago en breve.",
      });

    } else {
      // ❌ Vendedor cancela → cancelar lote y notificar compradores
      await db.collection("lots").doc(lotId).update({
        status: "cancelled_by_seller",
        sellerCancelledAt: FieldValue.serverTimestamp(),
        sellerConfirmed: false,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Notificar a todos los compradores
      await cancelLotAndNotifyBuyers(lotId, lotData, "seller_cancelled");

      console.log(`❌ Vendedor canceló lote ${lotId} por falta de stock`);

      return NextResponse.json({
        success: true,
        message: "Lote cancelado. Los compradores serán notificados.",
      });
    }

  } catch (error: any) {
    console.error("❌ Error en confirm-stock:", error);
    return NextResponse.json({ error: "Error procesando confirmación" }, { status: 500 });
  }
}

/* ====================================================
   CANCELAR LOTE Y NOTIFICAR COMPRADORES
==================================================== */
export async function cancelLotAndNotifyBuyers(
  lotId: string,
  lotData: any,
  reason: "seller_cancelled" | "timeout"
) {
  const reservationsSnap = await db
    .collection("reservations")
    .where("lotId", "==", lotId)
    .where("status", "==", "pending_lot")
    .get();

  if (reservationsSnap.empty) return;

  const productName = lotData.productName || "Producto";

  const reasonText = reason === "seller_cancelled"
    ? "el vendedor reportó no tener stock disponible"
    : "el vendedor no confirmó el stock a tiempo";

  // Cancelar todas las reservas
  const batch = db.batch();
  reservationsSnap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: "cancelled",
      cancellationReason: reason,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  // Mandar emails a todos los compradores
  for (const doc of reservationsSnap.docs) {
    const r = doc.data();
    if (!r.retailerEmail) continue;

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;}
  .container{background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:3px solid #dc2626;padding-bottom:20px;margin-bottom:30px;}
  .header h1{color:#dc2626;margin:0;font-size:22px;}
  .section{margin:25px 0;padding:20px;background:#f9fafb;border-radius:6px;border-left:4px solid #dc2626;}
  .info{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0;}
  .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;}
</style>
</head><body><div class="container">
  <div class="header"><h1>❌ Lote Cancelado — ${productName}</h1></div>
  <p>Hola <strong>${r.retailerName}</strong>,</p>
  <p>Lamentablemente el lote de <strong>${productName}</strong> fue cancelado porque ${reasonText}.</p>
  <div class="info">
    <p style="margin:0;font-weight:600;color:#991b1b;">¿Qué pasa con tu dinero?</p>
    <p style="margin:8px 0 0;color:#7f1d1d;font-size:14px;">
      No se realizó ningún cobro. Tu reserva fue cancelada sin costo y no se procesó ningún pago.
    </p>
  </div>
  <div class="section">
    <p style="margin:0;font-weight:600;">¿Qué podés hacer?</p>
    <ul style="margin:10px 0;padding-left:20px;font-size:14px;color:#374151;">
      <li>Buscar el mismo producto de otro vendedor en el explorador</li>
      <li>Reservar un lugar en el próximo lote cuando haya stock disponible</li>
    </ul>
  </div>
  <p style="text-align:center;">
    <a href="https://mayoristamovil.com/explorar" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Ver otros productos →
    </a>
  </p>
  <div class="footer"><p><strong>Mayorista Móvil</strong></p></div>
</div></body></html>`;

    try {
      await sendEmail({
        to: r.retailerEmail,
        subject: `❌ Lote cancelado — ${productName}`,
        html,
      });
    } catch (err) {
      console.error(`❌ Error enviando email de cancelación a ${r.retailerEmail}:`, err);
    }
  }

  console.log(`✅ ${reservationsSnap.size} compradores notificados de cancelación del lote ${lotId}`);
}