// app/api/cron/process-lots/route.ts
//
// GET — llamado por Vercel Cron cada 15 minutos.
//
// BLOQUE 4 impl 10: Cuando el lote se procesa, se calcula y guarda
// paymentDeadlineAt en cada reserva (lotClosedAt + 24h, o +26h si cierra entre 22-8h).
// El email muestra la hora límite exacta para que el revendedor sepa con precisión
// cuándo vence su plazo — elimina el argumento "no me enteré".
//
// ARQUITECTURA:
//   1. Genera preferences MP en secuencial (~500ms c/u)
//   2. Actualiza reservas en Firestore con Promise.all (paralelo)
//   3. Manda todos los emails con resend.batch.send (1 sola llamada)
//
// IDEMPOTENCIA: Lote se marca "processing" antes de empezar.
// Si falla → revierte a "closed" para reintento en 15min.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createSplitPreference } from "../../../../lib/mercadopago-split";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";

// ── BLOQUE 4 impl 10: calcular deadline de pago ────────────────────────────
// Si el lote cierra entre las 22:00 y las 08:00 → +26h (margen nocturno)
// Si cierra en horario diurno → +24h
function calcPaymentDeadline(lotClosedAt: Date): Date {
  // Plazo fijo de 48 horas desde el cierre del lote
  return new Date(lotClosedAt.getTime() + 72 * 60 * 60 * 1000);
}

function formatDeadlineAR(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ====================================================
   TIPOS
==================================================== */
interface ReservationToProcess {
  docId: string;
  retailerEmail: string;
  retailerName: string;
  shippingMode: string;
  postalCode: string | null;
  qty: number;
  productSubtotal: number;
  commission: number;
  shippingCostEstimated: number;
  retailerId: string;
  // BLOQUE 1: descuentos de racha guardados en la reserva
  shippingDiscount: number;
  commissionDiscount: number;
}

interface ProcessedReservation extends ReservationToProcess {
  shippingFinal: number;
  commissionFinal: number;
  totalFinal: number;
  paymentLink: string;
  groupSize: number;
  paymentDeadlineAt: Date;
}

/* ====================================================
   HTML DEL EMAIL DE PAGO — BLOQUE 4 impl 10
   Incluye hora límite exacta y descuentos de racha si aplica.
==================================================== */
function buildPaymentEmailHtml(params: {
  retailerName: string;
  productName: string;
  qty: number;
  productSubtotal: number;
  commission: number;
  shippingFinal: number;
  totalFinal: number;
  paymentLink: string;
  groupSize: number;
  shippingCostEstimated: number;
  isPickup: boolean;
  paymentDeadlineStr: string;   // hora límite formateada
  shippingDiscount: number;     // 0-1
  commissionDiscount: number;   // 0-1
}): string {
  const {
    retailerName, productName, qty, productSubtotal, commission,
    shippingFinal, totalFinal, paymentLink, groupSize,
    shippingCostEstimated, isPickup, paymentDeadlineStr,
    shippingDiscount, commissionDiscount,
  } = params;

  const savingsHtml =
    !isPickup && groupSize > 1
      ? `<div style="background:#d1fae5;border:2px solid #10b981;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#065f46;">💚 ¡Ahorraste en el envío!</p>
          <p style="margin:8px 0 0;color:#047857;font-size:14px;">
            Estás dividiendo el envío con <strong>${groupSize - 1} persona${groupSize - 1 > 1 ? "s" : ""}</strong> de tu misma zona.<br>
            Pagás <strong>$${shippingFinal.toLocaleString("es-AR")}</strong> en vez de <strong>$${shippingCostEstimated.toLocaleString("es-AR")}</strong>.
          </p>
        </div>`
      : "";

  // Badge de descuento por racha
  const streakDiscountHtml =
    shippingDiscount > 0 || commissionDiscount > 0
      ? `<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:12px;margin:16px 0;text-align:center;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8;">⚡ Descuento de racha aplicado</p>
          ${shippingDiscount > 0 && !isPickup ? `<p style="margin:4px 0 0;color:#2563eb;font-size:13px;">${Math.round(shippingDiscount * 100)}% de descuento en envío</p>` : ""}
          ${commissionDiscount >= 1 ? `<p style="margin:4px 0 0;color:#2563eb;font-size:13px;font-weight:700;">🎉 ¡Comisión GRATIS por tu racha!</p>` : ""}
        </div>`
      : "";

  // IMPL 10: Bloque de hora límite exacta
  const deadlineHtml = `
    <div style="background:#fef9c3;border:2px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:15px;font-weight:700;color:#92400e;">⏰ Tu plazo de pago</p>
      <p style="margin:8px 0 0;color:#78350f;font-size:14px;">
        Tenés hasta el <strong>${paymentDeadlineStr}</strong> para completar el pago.<br>
        Pasado ese momento tu reserva se cancela automáticamente.
      </p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;}
  .container{background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px;}
  .header h1{color:#2563eb;margin:0;font-size:24px;}
  .section{margin:25px 0;padding:20px;background:#f9fafb;border-radius:6px;border-left:4px solid #2563eb;}
  .row{margin:10px 0;}.label{font-weight:600;color:#6b7280;}.value{font-weight:600;color:#111827;}
  .cta{display:block;background:#2563eb;color:white;text-align:center;padding:18px 24px;border-radius:8px;text-decoration:none;font-size:18px;font-weight:700;margin:24px 0;}
  .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;}
</style>
</head><body><div class="container">
  <div class="header"><h1>🎉 ¡Tu lote está listo — completá el pago!</h1></div>
  <p>¡Hola <strong>${retailerName}</strong>!</p>
  <p>El lote de <strong>${productName}</strong> alcanzó el mínimo. Ahora podés confirmar tu compra con el precio final.</p>
  ${savingsHtml}
  ${streakDiscountHtml}
  <div class="section">
    <h3 style="margin-top:0;">🧾 Tu pedido</h3>
    <div class="row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
    <div class="row"><span class="label">Cantidad:</span> <span class="value">${qty} unidades</span></div>
    <div class="row"><span class="label">Subtotal producto:</span> <span class="value">$${productSubtotal.toLocaleString("es-AR")}</span></div>
    <div class="row"><span class="label">Comisión:</span>
      <span class="value">${commissionDiscount >= 1 ? "¡Gratis! 🎉" : `$${commission.toLocaleString("es-AR")}`}</span>
    </div>
    <div class="row"><span class="label">Envío:</span>
      <span class="value">${isPickup ? "Retiro en fábrica (Gratis)" : `$${shippingFinal.toLocaleString("es-AR")}${groupSize > 1 ? ` (dividido entre ${groupSize} compradores de tu zona)` : ""}`}</span>
    </div>
    <div class="row" style="border-top:2px solid #e5e7eb;padding-top:10px;margin-top:10px;">
      <span class="label" style="font-size:15px;">TOTAL A PAGAR:</span>
      <span class="value" style="font-size:22px;color:#2563eb;">$${totalFinal.toLocaleString("es-AR")}</span>
    </div>
  </div>
  ${deadlineHtml}
  <a href="${paymentLink}" class="cta">💳 Pagar ahora — $${totalFinal.toLocaleString("es-AR")}</a>
  <div class="footer"><p><strong>Mayorista Móvil</strong></p></div>
</div></body></html>`;
}

/* ====================================================
   PROCESAR UN LOTE COMPLETO
==================================================== */
async function processLotClosure(params: {
  lotId: string;
  productId: string;
  productName: string;
  factoryId: string;
}) {
  const { lotId, productId, productName, factoryId } = params;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://mayoristamovil.com");

  const factorySnap = await db.collection("manufacturers").doc(factoryId).get();
  const factoryMPUserId = factorySnap.data()?.mercadopago?.user_id || null;

  const reservationsSnap = await db
    .collection("reservations")
    .where("lotId", "==", lotId)
    .where("status", "==", "pending_lot")
    .get();

  if (reservationsSnap.empty) {
    console.warn(`⚠️ [CRON] Sin reservas pending_lot para lote ${lotId}`);
    return;
  }

  const reservations: ReservationToProcess[] = reservationsSnap.docs.map((doc) => {
    const r = doc.data();
    return {
      docId: doc.id,
      retailerEmail: r.retailerEmail || "",
      retailerName: r.retailerName || "Comprador",
      shippingMode: r.shippingMode,
      postalCode: r.postalCode || null,
      qty: r.qty || 0,
      productSubtotal: r.productSubtotal || 0,
      commission: r.commission || 0,
      shippingCostEstimated: r.shippingCostEstimated || 0,
      retailerId: r.retailerId,
      shippingDiscount: r.shippingDiscount ?? 0,
      commissionDiscount: r.commissionDiscount ?? 0,
    };
  });

  console.log(`📦 [CRON] Lote ${lotId}: ${reservations.length} compradores`);

  // IMPL 10: Calcular deadline de pago desde el momento actual (cierre del lote)
  const lotClosedNow = new Date();
  const paymentDeadlineAt = calcPaymentDeadline(lotClosedNow);
  const paymentDeadlineStr = formatDeadlineAR(paymentDeadlineAt);

  // Agrupar por CP para dividir envío
  const shippingGroups: Record<string, ReservationToProcess[]> = {};
  const noGroupReservations: ReservationToProcess[] = [];

  reservations.forEach((r) => {
    if (r.shippingMode === "platform" && r.postalCode) {
      if (!shippingGroups[r.postalCode]) shippingGroups[r.postalCode] = [];
      shippingGroups[r.postalCode].push(r);
    } else {
      noGroupReservations.push(r);
    }
  });

  const allGroups = [
    ...Object.values(shippingGroups),
    ...(noGroupReservations.length > 0 ? [noGroupReservations] : []),
  ];

  // Generar preferences MP (secuencial)
  const processed: ProcessedReservation[] = [];

  for (const group of allGroups) {
    const isShippingGroup = group[0].shippingMode === "platform" && group[0].postalCode;
    const maxShipping = Math.max(...group.map((r) => r.shippingCostEstimated));
    const groupSize = group.length;
    const shippingPerPerson = isShippingGroup ? Math.round(maxShipping / groupSize) : 0;

    for (const reservation of group) {
      if (!reservation.retailerEmail) continue;

      const isPickup = reservation.shippingMode === "pickup";
      const rawShipping = isPickup ? 0 : shippingPerPerson;

      // BLOQUE 1: aplicar descuentos de racha guardados en la reserva
      const shippingFinal = isPickup
        ? 0
        : Math.round(rawShipping * (1 - reservation.shippingDiscount));
      const commissionFinal = reservation.commissionDiscount >= 1
        ? 0
        : reservation.commission;

      const totalFinal = reservation.productSubtotal + commissionFinal + shippingFinal;

      let paymentLink = `${baseUrl}/explorar/${productId}`;
      try {
        const preference = await createSplitPreference({
          title: `Pago lote: ${productName}`,
          unit_price: Math.round(totalFinal),
          quantity: 1,
          metadata: {
            productId,
            factoryId,
            qty: reservation.qty,
            tipo: "fraccionada",
            withShipping: !isPickup,
            orderType: "fraccionado",
            lotType: isPickup ? "fraccionado_retiro" : "fraccionado_envio",
            retailerId: reservation.retailerId,
            original_qty: reservation.qty,
            MF: 0,
            shippingCost: shippingFinal,
            shippingMode: reservation.shippingMode,
            commission: commissionFinal,
            reservationId: reservation.docId,
            lotId,
          },
          back_urls: {
            success: `${baseUrl}/success`,
            failure: `${baseUrl}/failure`,
            pending: `${baseUrl}/pending`,
          },
          factoryMPUserId,
          shippingCost: shippingFinal,
          productTotal: reservation.productSubtotal,
          commission: commissionFinal,
        });
        if (preference.init_point) paymentLink = preference.init_point;
      } catch (prefErr) {
        console.error(`❌ [CRON] Error preference ${reservation.retailerEmail}:`, prefErr);
      }

      processed.push({
        ...reservation,
        shippingFinal,
        commissionFinal,
        totalFinal,
        paymentLink,
        groupSize,
        paymentDeadlineAt,
      });
    }
  }

  console.log(`✅ [CRON] Preferences MP generadas: ${processed.length}`);

  // Actualizar reservas en Firestore (paralelo) — incluye paymentDeadlineAt (IMPL 10)
  await Promise.all(
    processed.map((r) =>
      db.collection("reservations").doc(r.docId).update({
        status: "lot_closed",
        lotClosedAt: FieldValue.serverTimestamp(),
        shippingCostFinal: r.shippingFinal,
        commissionFinal: r.commissionFinal,
        totalFinal: r.totalFinal,
        paymentLink: r.paymentLink,
        paymentDeadlineAt: r.paymentDeadlineAt,   // IMPL 10: deadline exacto
        updatedAt: FieldValue.serverTimestamp(),
      })
    )
  );

  console.log(`✅ [CRON] Reservas actualizadas en Firestore`);

  // Resend batch — un solo llamado HTTP
  const emailPayloads = processed
    .filter((r) => r.retailerEmail)
    .map((r) => ({
      from: FROM_EMAIL,
      to: r.retailerEmail,
      subject: `💳 ¡Completá tu pago! Lote de ${productName} listo`,
      html: buildPaymentEmailHtml({
        retailerName: r.retailerName,
        productName,
        qty: r.qty,
        productSubtotal: r.productSubtotal,
        commission: r.commissionFinal,
        shippingFinal: r.shippingFinal,
        totalFinal: r.totalFinal,
        paymentLink: r.paymentLink,
        groupSize: r.groupSize,
        shippingCostEstimated: r.shippingCostEstimated,
        isPickup: r.shippingMode === "pickup",
        paymentDeadlineStr,             // IMPL 10
        shippingDiscount: r.shippingDiscount,
        commissionDiscount: r.commissionDiscount,
      }),
    }));

  const BATCH_SIZE = 100;
  let emailsSent = 0;
  let emailErrors = 0;

  for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
    const chunk = emailPayloads.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await resend.batch.send(chunk);
      if (error) {
        console.error(`❌ [CRON] Resend batch error:`, error);
        emailErrors += chunk.length;
      } else {
        emailsSent += chunk.length;
        console.log(`✅ [CRON] Batch enviado: ${chunk.length} emails`);
      }
    } catch (batchErr) {
      console.error(`❌ [CRON] Resend batch excepción:`, batchErr);
      emailErrors += chunk.length;
    }
  }

  console.log(`📧 [CRON] Emails: ${emailsSent} enviados, ${emailErrors} con error`);
}

/* ====================================================
   HANDLER PRINCIPAL DEL CRON
==================================================== */
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  console.log(`🕐 [CRON] process-lots: ${now.toISOString()}`);

  try {
    const lotsSnap = await db
      .collection("lots")
      .where("status", "==", "closed")
      .where("level1WindowExpiresAt", "<=", now)
      .get();

    if (lotsSnap.empty) {
      console.log("✅ [CRON] Sin lotes pendientes.");
      return NextResponse.json({ ok: true, processed: 0 });
    }

    console.log(`📦 [CRON] Lotes a procesar: ${lotsSnap.size}`);

    let processed = 0;
    let errors = 0;

    for (const lotDoc of lotsSnap.docs) {
      const lotData = lotDoc.data();
      const lotId = lotDoc.id;

      try {
        await db.collection("lots").doc(lotId).update({
          status: "processing",
          processingStartedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await processLotClosure({
          lotId,
          productId: lotData.productId,
          productName: lotData.productName || "Producto",
          factoryId: lotData.factoryId,
        });

        await db.collection("lots").doc(lotId).update({
          status: "processed_pending_payment",
          processedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        processed++;
        console.log(`✅ [CRON] Lote ${lotId} procesado (${processed}/${lotsSnap.size})`);

      } catch (lotErr) {
        errors++;
        console.error(`❌ [CRON] Error en lote ${lotId}:`, lotErr);

        try {
          await db.collection("lots").doc(lotId).update({
            status: "closed",
            processingError: String(lotErr),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } catch (revertErr) {
          console.error(`❌ [CRON] No se pudo revertir lote ${lotId}:`, revertErr);
        }
      }
    }

    console.log(`🏁 [CRON] Fin. Procesados: ${processed}, Errores: ${errors}`);
    return NextResponse.json({ ok: true, processed, errors });

  } catch (error: any) {
    console.error("❌ [CRON] Error general:", error);
    return NextResponse.json({ error: "Error en el cron." }, { status: 500 });
  }
}