// app/api/cron/process-lots/route.ts
//
// ✅ BLOQUE E v2 — Solo procesa lotes confirmados (TIPO A).
// El paso de confirmación del vendedor (TIPO B) está retirado.
// Los lotes pasan directo a "closed" desde reserve/route.ts.
//
// FLUJO ACTUAL:
//   1. Reserva alcanza el mínimo en reserve/route.ts → lote queda "closed" + level1WindowExpiresAt (2hs)
//   2. Durante esas 2hs, solo Nivel 1 puede sumarse al lote
//   3. Cuando vence level1WindowExpiresAt → este cron lo procesa: manda emails de pago
//   4. Cuando todos pagan (webhook MP) → lote pasa a "fully_paid"
//
// ✅ BLOQUE D: comisión MP del 4% calculada en runtime sobre (producto + envío).
//    Si retiro en fábrica → 4% solo sobre producto.

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

// ✅ BLOQUE D: tasa comisión MP
const MP_COMMISSION_RATE = 0.04;

/* ====================================================
   CALCULAR DEADLINE DE PAGO
==================================================== */
function calcPaymentDeadline(lotClosedAt: Date): Date {
  // 72h desde el cierre del lote
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
   HTML DEL EMAIL DE PAGO
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
  paymentDeadlineStr: string;
  shippingDiscount: number;
  commissionDiscount: number;
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

  const streakDiscountHtml =
    shippingDiscount > 0 || commissionDiscount > 0
      ? `<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:12px;margin:16px 0;text-align:center;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8;">⚡ Descuento de racha aplicado</p>
          ${shippingDiscount > 0 && !isPickup ? `<p style="margin:4px 0 0;color:#2563eb;font-size:13px;">${Math.round(shippingDiscount * 100)}% de descuento en envío</p>` : ""}
          ${commissionDiscount >= 1 ? `<p style="margin:4px 0 0;color:#2563eb;font-size:13px;font-weight:700;">🎉 ¡Comisión GRATIS por tu racha!</p>` : ""}
        </div>`
      : "";

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
  <p>El lote de <strong>${productName}</strong> alcanzó el mínimo. Ahora podés confirmar tu compra.</p>
  ${savingsHtml}
  ${streakDiscountHtml}
  <div class="section">
    <h3 style="margin-top:0;">🧾 Tu pedido</h3>
    <div class="row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
    <div class="row"><span class="label">Cantidad:</span> <span class="value">${qty} unidades</span></div>
    <div class="row"><span class="label">Subtotal producto:</span> <span class="value">$${productSubtotal.toLocaleString("es-AR")}</span></div>
    <div class="row"><span class="label">Envío:</span>
      <span class="value">${isPickup ? "Retiro en fábrica (Gratis)" : `$${shippingFinal.toLocaleString("es-AR")}${groupSize > 1 ? ` (dividido entre ${groupSize} compradores de tu zona)` : ""}`}</span>
    </div>
    <div class="row"><span class="label">Comisión MP (4%):</span>
      <span class="value">${commissionDiscount >= 1 ? "¡Gratis! 🎉" : `$${commission.toLocaleString("es-AR")}`}</span>
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
   PROCESAR UN LOTE CERRADO
   — Vencida la ventana de Nivel 1 → mandar links de pago
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

  // Buscar MP userId del vendedor en cualquier colección
  let factoryMPUserId: string | null = null;
  for (const col of ["manufacturers", "distributors", "wholesalers"]) {
    const snap = await db.collection(col).doc(factoryId).get();
    if (snap.exists) {
      factoryMPUserId = snap.data()?.mercadopago?.user_id || null;
      if (factoryMPUserId) break;
    }
  }

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

  // Generar preferences MP (secuencial para no saturar la API)
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

      const shippingFinal = isPickup
        ? 0
        : Math.round(rawShipping * (1 - reservation.shippingDiscount));

      // ✅ BLOQUE D: comisión MP del 4% calculada en runtime sobre (producto + envío).
      // Si retiro en fábrica → solo sobre producto.
      // Si racha 50 (commissionDiscount >= 1) → 0.
      const baseForCommission = isPickup
        ? reservation.productSubtotal
        : reservation.productSubtotal + shippingFinal;

      const commissionFinal = reservation.commissionDiscount >= 1
        ? 0
        : Math.round(baseForCommission * MP_COMMISSION_RATE);

      const totalFinal = reservation.productSubtotal + shippingFinal + commissionFinal;

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
          factoryMPUserId: factoryMPUserId ?? undefined,
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

  // Actualizar reservas en Firestore (paralelo)
  await Promise.all(
    processed.map((r) =>
      db.collection("reservations").doc(r.docId).update({
        status: "lot_closed",
        lotClosedAt: FieldValue.serverTimestamp(),
        shippingCostFinal: r.shippingFinal,
        commissionFinal: r.commissionFinal,
        totalFinal: r.totalFinal,
        paymentLink: r.paymentLink,
        paymentDeadlineAt: r.paymentDeadlineAt,
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
        paymentDeadlineStr,
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
    let processed = 0;
    let errors = 0;

    /* ─────────────────────────────────────────────────
       Lotes "closed" con ventana Nivel 1 vencida
       → Procesar pagos: mandar emails con links
    ───────────────────────────────────────────────── */
    const lotsClosedSnap = await db
      .collection("lots")
      .where("status", "==", "closed")
      .where("level1WindowExpiresAt", "<=", now)
      .get();

    console.log(`📦 [CRON] Lotes a procesar: ${lotsClosedSnap.size}`);

    for (const lotDoc of lotsClosedSnap.docs) {
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
        console.log(`✅ [CRON] Lote procesado: ${lotId}`);

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