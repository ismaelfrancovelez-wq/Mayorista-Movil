// app/api/lots/fraccionado/reserve/route.ts
//
// POST  { productId, qty, shippingMode: "pickup" | "platform" }
//
// FLUJO DE ESTADOS DE LA RESERVA:
//   "pending_lot"  → esperando que el lote cierre
//   "lot_closed"   → lote cerró, email enviado, esperando pago
//   "paid"         → pagó (webhook lo actualiza)
//   "cancelled"    → cancelada
//
// ✅ FIX CRÍTICO: processLotClosure se llama con AWAIT.
//
// ✅ Sistema de niveles de confianza.
//
// ✅ BLOQUE 1 — Descuentos por racha.
//
// ✅ Ventana de 2h post-cierre para Nivel 1.
//
// ✅ db.runTransaction en la sección crítica.
//
// ✅ BLOQUE D — Comisión MP del 4%.
//    - Al RESERVAR: NO calculamos commission (depende del envío final).
//      Solo guardamos productSubtotal BASE y commission=0 placeholder.
//    - Al CERRAR el lote: en processLotClosure recalculamos
//      commissionFinal = (productSubtotal + shippingFinal) × 0.04
//      Si retiro en fábrica → commissionFinal = productSubtotal × 0.04
//      totalFinal = productSubtotal + shippingFinal + commissionFinal
//
// ✅ FIX MINIMUM ORDER: al actualizar un lote existente, sincronizar
//    minimumOrder, minimumValue y minimumType con el producto actual.
//    Si el vendedor cambió el mínimo (siempre validado >= accumulatedQty
//    en edit/route.ts), el lote refleja el nuevo valor.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { calculateFraccionadoShipping } from "../../../../../lib/shipping";
import { sendEmail } from "../../../../../lib/email/client";
import { createSplitPreference } from "../../../../../lib/mercadopago-split";
import rateLimit from "../../../../../lib/rate-limit";
import { getStreakDiscounts } from "../../../../../lib/retailers/calculateScore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

// ✅ BLOQUE D: tasa de comisión MP
const MP_COMMISSION_RATE = 0.04;

function extractPostalCode(addr: string): string | null {
  if (!addr) return null;
  const alphaMatch = addr.match(/\b([A-Z]\d{4}[A-Z]{0,3})\b/);
  if (alphaMatch) return alphaMatch[1];
  const numMatch = addr.match(/\b(\d{4})\b/);
  if (numMatch) return numMatch[1];
  return null;
}

/* ====================================================
   PROCESAR CIERRE DE LOTE
==================================================== */
async function processLotClosure(params: {
  lotId: string;
  productId: string;
  productName: string;
  factoryId: string;
  factoryName: string;
}) {
  const { lotId, productId, productName, factoryId } = params;
  console.log(`🔒 Procesando cierre de lote: ${lotId}`);

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
    console.warn(`⚠️ No hay reservas pending_lot para lote ${lotId}`);
    return;
  }

  // Agrupar por CP
  const shippingGroups: Record<string, typeof reservationsSnap.docs> = {};
  const noGroupDocs: typeof reservationsSnap.docs = [];

  reservationsSnap.docs.forEach((doc) => {
    const r = doc.data();
    if (r.shippingMode === "platform" && r.postalCode) {
      if (!shippingGroups[r.postalCode]) shippingGroups[r.postalCode] = [];
      shippingGroups[r.postalCode].push(doc);
    } else {
      noGroupDocs.push(doc);
    }
  });

  const allGroups = [
    ...Object.values(shippingGroups),
    ...(noGroupDocs.length > 0 ? [noGroupDocs] : []),
  ];

  for (const groupDocs of allGroups) {
    const isShippingGroup =
      groupDocs[0].data().shippingMode === "platform" &&
      groupDocs[0].data().postalCode;
    const maxShipping = Math.max(
      ...groupDocs.map((d) => d.data().shippingCostEstimated || 0)
    );
    const groupSize = groupDocs.length;
    const shippingPerPerson = isShippingGroup
      ? Math.round(maxShipping / groupSize)
      : 0;

    for (const reservationDoc of groupDocs) {
      const r = reservationDoc.data();
      if (!r.retailerEmail) continue;

      const isPickup = r.shippingMode === "pickup";

      // ── BLOQUE 1: aplicar descuento de racha guardado en la reserva ──
      const savedShippingDiscount: number = r.shippingDiscount ?? 0;
      const savedCommissionDiscount: number = r.commissionDiscount ?? 0;

      const rawShipping = isPickup ? 0 : shippingPerPerson;
      const shippingFinal = isPickup
        ? 0
        : Math.round(rawShipping * (1 - savedShippingDiscount));

      // ✅ BLOQUE D: calcular commissionFinal en runtime sobre (producto + envío)
      // Si retiro en fábrica → solo sobre producto.
      // Si racha 50 (commissionDiscount >= 1) → 0.
      const productSubtotal = r.productSubtotal || 0;
      const baseForCommission = isPickup
        ? productSubtotal
        : productSubtotal + shippingFinal;

      const commissionFinal = savedCommissionDiscount >= 1
        ? 0
        : Math.round(baseForCommission * MP_COMMISSION_RATE);

      const totalFinal = productSubtotal + shippingFinal + commissionFinal;

      // Generar link de pago
      let paymentLink = `${baseUrl}/explorar/${productId}`;
      try {
        const preference = await createSplitPreference({
          title: `Pago lote: ${productName}`,
          unit_price: Math.round(totalFinal),
          quantity: 1,
          metadata: {
            productId,
            factoryId,
            qty: r.qty,
            tipo: "fraccionada",
            withShipping: !isPickup,
            orderType: "fraccionado",
            lotType: isPickup ? "fraccionado_retiro" : "fraccionado_envio",
            retailerId: r.retailerId,
            original_qty: r.qty,
            MF: 0,
            shippingCost: shippingFinal,
            shippingMode: r.shippingMode,
            commission: commissionFinal,
            reservationId: reservationDoc.id,
            lotId,
          },
          back_urls: {
            success: `${baseUrl}/success`,
            failure: `${baseUrl}/failure`,
            pending: `${baseUrl}/pending`,
          },
          factoryMPUserId,
          shippingCost: shippingFinal,
          productTotal: productSubtotal,
          commission: commissionFinal,
        });
        if (preference.init_point) paymentLink = preference.init_point;
      } catch (prefErr) {
        console.error(`❌ Error creando preferencia para ${r.retailerEmail}:`, prefErr);
      }

      await db.collection("reservations").doc(reservationDoc.id).update({
        status: "lot_closed",
        lotClosedAt: FieldValue.serverTimestamp(),
        shippingCostFinal: shippingFinal,
        commissionFinal,
        totalFinal,
        paymentLink,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ── Email ────────────────────────────────────────────────────
      const discountLine = savedShippingDiscount > 0 && !isPickup
        ? `<div class="row" style="color:#16a34a;"><span class="label">Descuento racha envío (${Math.round(savedShippingDiscount * 100)}%):</span> <span class="value">-$${Math.round(rawShipping * savedShippingDiscount).toLocaleString("es-AR")}</span></div>`
        : "";
      const freeShippingNote = isPickup
        ? "Retiro en fábrica (Gratis)"
        : `$${shippingFinal.toLocaleString("es-AR")}${groupSize > 1 ? ` (dividido entre ${groupSize} compradores de tu zona)` : ""}`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);}
  h2{color:#1d4ed8;margin-top:0;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;}
  .label{color:#6b7280;}
  .value{font-weight:600;color:#111827;}
  .warning{background:#fef9c3;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;}
  .cta{display:block;background:#2563eb;color:#fff;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin-top:16px;}
  .footer{text-align:center;color:#9ca3af;font-size:12px;margin-top:20px;}
</style></head><body>
<div class="card">
  <h2>💳 ¡Tu lote está listo para pagar!</h2>
  <p>El lote de <strong>${productName}</strong> alcanzó el mínimo de compra.</p>
  <div class="row"><span class="label">Cantidad:</span> <span class="value">${r.qty} unidades</span></div>
  <div class="row"><span class="label">Subtotal producto:</span> <span class="value">$${productSubtotal.toLocaleString("es-AR")}</span></div>
  <div class="row"><span class="label">Envío:</span><span class="value">${freeShippingNote}</span></div>
  <div class="row"><span class="label">Comisión MP (4%):</span> <span class="value">${commissionFinal === 0 ? "¡Gratis! 🎉" : `$${commissionFinal.toLocaleString("es-AR")}`}</span></div>
  ${discountLine}
  <div class="row" style="border-top:2px solid #e5e7eb;padding-top:10px;margin-top:10px;">
    <span class="label" style="font-size:15px;">TOTAL A PAGAR:</span>
    <span class="value" style="font-size:22px;color:#2563eb;">$${totalFinal.toLocaleString("es-AR")}</span>
  </div>
  <div class="warning"><strong>⏰ Importante:</strong> Tenés <strong>48 horas</strong> para completar el pago o tu reserva se cancelará.</div>
  <a href="${paymentLink}" class="cta">💳 Pagar ahora — $${totalFinal.toLocaleString("es-AR")}</a>
  <div class="footer"><p><strong>Mayorista Móvil</strong></p></div>
</div></body></html>`;

      try {
        await sendEmail({
          to: r.retailerEmail,
          subject: `💳 ¡Completá tu pago! Lote de ${productName} listo`,
          html,
        });
        console.log(`✅ Email enviado a: ${r.retailerEmail}`);
      } catch (emailErr) {
        console.error(`❌ Error enviando email a ${r.retailerEmail}:`, emailErr);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  console.log(`✅ Cierre de lote procesado correctamente: ${lotId}`);
}

/* ====================================================
   HANDLER PRINCIPAL
==================================================== */
export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  try {
    await limiter.check(10, ip);
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }

  try {
    /* ── 1. AUTH ────────────────────────────────────── */
    const retailerId = cookies().get("userId")?.value;
    if (!retailerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    /* ── 2. BODY ────────────────────────────────────── */
    const body = await req.json();
    const { productId, qty, shippingMode } = body;
    const minimumIndex: number = Number(body.minimumIndex ?? 0);
    const formatIndex: number = Number(body.formatIndex ?? 0);

    if (
      !productId ||
      !qty ||
      Number(qty) <= 0 ||
      !shippingMode ||
      !["pickup", "platform"].includes(shippingMode)
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    /* ── 3. DIRECCIÓN DEL RETAILER ──────────────────── */
    const retailerSnap = await db.collection("retailers").doc(retailerId).get();
    let retailerAddressText: string | null = null;
    let postalCode: string | null = null;

    if (retailerSnap.exists) {
      retailerAddressText =
        retailerSnap.data()?.address?.formattedAddress ?? null;
      if (retailerAddressText) postalCode = extractPostalCode(retailerAddressText);
    }

    if (!retailerAddressText && shippingMode === "platform") {
      return NextResponse.json(
        {
          error:
            "Configurá tu dirección en tu perfil antes de reservar. La necesitamos para calcular el envío.",
          missingAddress: true,
        },
        { status: 400 }
      );
    }

    const retailerLevel: number = retailerSnap.data()?.paymentLevel ?? 2;
    const retailerScore: number = retailerSnap.data()?.reliabilityScore ?? 0.6;

    const currentStreak: number = retailerSnap.data()?.currentStreak ?? 0;
    const { shippingDiscount, commissionDiscount } = getStreakDiscounts(currentStreak);

    /* ── 4. PRODUCTO Y FÁBRICA ──────────────────────── */
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const productData = productSnap.data()!;
    const factoryId = productData.factoryId;
    const productName = productData.name || "Producto";

    let productPrice: number;
    let minimumOrder: number;
    let minimumType: "quantity" | "amount" = "quantity";
    let minimumValue: number;

    const productMins = Array.isArray(productData.minimums) && productData.minimums.length > 0
      ? productData.minimums
      : null;

    if (productMins) {
      const selMin = productMins[minimumIndex] ?? productMins[0];
      const selFmt = selMin?.formats?.[formatIndex] ?? selMin?.formats?.[0];
      productPrice = selFmt?.price ?? productData.price ?? 0; // ✅ BASE
      minimumType = selMin?.type === "amount" ? "amount" : "quantity";
      minimumValue = selMin?.value ?? productData.minimumOrder ?? 0;
      minimumOrder = minimumType === "quantity" ? minimumValue : productData.minimumOrder || 1;
    } else {
      productPrice = productData.price || 0; // ✅ BASE
      minimumValue = productData.minimumOrder || 0;
      minimumOrder = minimumValue;
    }

    if (!minimumValue || minimumValue <= 0) {
      return NextResponse.json(
        { error: "Este producto no tiene un mínimo de compra configurado. Contactá al administrador." },
        { status: 400 }
      );
    }
    const productSubtotal = productPrice * Number(qty);

    // ✅ BLOQUE D: NO calculamos commission al reservar (depende del envío final).
    // Lo dejamos en 0 como placeholder. Se calcula en processLotClosure.
    const commission = 0;

    // Esta variable se mantiene solo para el response (savings vs Nivel 1)
    const PLATFORM_COMMISSION_RATE = MP_COMMISSION_RATE;
    const effectiveCommissionRate = PLATFORM_COMMISSION_RATE;

    const factorySnap = await db.collection("manufacturers").doc(factoryId).get();
    if (!factorySnap.exists) {
      return NextResponse.json({ error: "Fábrica no encontrada" }, { status: 404 });
    }
    const factoryData = factorySnap.data()!;
    const factoryAddressText = factoryData.address?.formattedAddress ?? null;
    const factoryName =
      factoryData.businessName || factoryData.name || "Fabricante";

    /* ── 5. ENVÍO ESTIMADO ──────────────────────────── */
    let shippingCostEstimated = 0;
    if (shippingMode === "platform" && factoryAddressText && retailerAddressText) {
      try {
        const result = await calculateFraccionadoShipping({
          factoryAddress: factoryAddressText,
          retailerAddress: retailerAddressText,
        });
        shippingCostEstimated = result.totalCost;
      } catch (err) {
        console.warn("⚠️ No se pudo calcular envío estimado:", err);
      }
    }

    /* ── 6. DATOS DEL RETAILER ──────────────────────── */
    const userSnap = await db.collection("users").doc(retailerId).get();
    const retailerName =
      userSnap.data()?.name ||
      userSnap.data()?.email?.split("@")[0] ||
      "Comprador";
    const retailerEmail = userSnap.data()?.email || "";

    /* ── 7-11. SECCIÓN CRÍTICA — TRANSACCIÓN ATÓMICA ─── */
    const SHIPPING_TYPES = new Set(["fractional_shipping", "fraccionado_envio"]);
    const PICKUP_TYPES = new Set(["fractional_pickup", "fraccionado_retiro"]);
    const targetTypes = shippingMode === "pickup" ? PICKUP_TYPES : SHIPPING_TYPES;
    const lotType =
      shippingMode === "pickup" ? "fractional_pickup" : "fractional_shipping";

    let txReservationId: string = "";
    let txFinalLotId: string = "";
    let txLotClosed: boolean = false;
    let txSkipMainFlow: boolean = false;

    // ── Ventana de 2h post-cierre para Nivel 1 ──
    if (retailerLevel === 1) {
      const closedLotSnap = await db
        .collection("lots")
        .where("productId", "==", productId)
        .where("status", "==", "closed")
        .where("type", "in", [...targetTypes])
        .limit(1)
        .get();

      if (!closedLotSnap.empty) {
        const closedLotDoc = closedLotSnap.docs[0];
        const closedLotData = closedLotDoc.data();
        const windowExpiresAt = closedLotData.level1WindowExpiresAt?.toMillis?.() ?? 0;
        const now = Date.now();
        const windowOpen = windowExpiresAt > now;

        if (windowOpen) {
          const dupClosedSnap = await db
            .collection("reservations")
            .where("retailerId", "==", retailerId)
            .where("lotId", "==", closedLotDoc.id)
            .where("status", "in", ["pending_lot", "lot_closed", "paid"])
            .limit(1)
            .get();

          if (!dupClosedSnap.empty) {
            return NextResponse.json(
              { error: "Ya tenés una reserva activa en este lote.", alreadyReserved: true },
              { status: 409 }
            );
          }

          const level1ReservationRef = db.collection("reservations").doc();
          await level1ReservationRef.set({
            retailerId,
            retailerName,
            retailerEmail,
            retailerAddress: retailerAddressText,
            postalCode: postalCode || null,
            productId,
            productName,
            factoryId,
            factoryName,
            qty: Number(qty),
            shippingMode,
            shippingCostEstimated,
            commission, // ✅ BLOQUE D: 0 placeholder, se calcula al cerrar
            productSubtotal,
            shippingDiscount,
            commissionDiscount,
            streakPointsAtReservation: currentStreak,
            lotId: closedLotDoc.id,
            status: "pending_lot",
            paymentLevel: retailerLevel,
            reliabilityScore: retailerScore,
            enteredDuringWindow: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          await db.collection("lots").doc(closedLotDoc.id).update({
            accumulatedQty: FieldValue.increment(Number(qty)),
            updatedAt: FieldValue.serverTimestamp(),
          });

          console.log(`🌟 Nivel 1 entró en ventana post-cierre. Lote: ${closedLotDoc.id}, Retailer: ${retailerId}`);

          return NextResponse.json({
            success: true,
            reservationId: level1ReservationRef.id,
            lotId: closedLotDoc.id,
            lotClosed: true,
            enteredWindow: true,
            commissionRate: Math.round(effectiveCommissionRate * 100),
            shippingDiscountPct: Math.round(shippingDiscount * 100),
            message: "¡Entraste al lote! Cuando se procese el cierre, te mandamos el link de pago a tu email.",
          });
        }
      }
    }

    // ── TRANSACCIÓN ATÓMICA ──
    await db.runTransaction(async (transaction) => {
      const lotQuery = db.collection("lots")
        .where("productId", "==", productId)
        .where("status", "in", ["accumulating", "open"])
        .where("type", "==", lotType)
        .limit(1);

      const lotSnap = await transaction.get(lotQuery);

      let targetLotRef;
      let currentQty = 0;
      let isNewLot = false;
      let activeLotProgress = 0;

      if (lotSnap.empty) {
        targetLotRef = db.collection("lots").doc();
        isNewLot = true;
      } else {
        targetLotRef = lotSnap.docs[0].ref;
        currentQty = lotSnap.docs[0].data().accumulatedQty || 0;
        activeLotProgress = minimumValue > 0 ? currentQty / minimumValue : 0;
      }

      if (!isNewLot) {
        const dupQuery = db.collection("reservations")
          .where("retailerId", "==", retailerId)
          .where("lotId", "==", targetLotRef.id)
          .where("status", "in", ["pending_lot", "lot_closed"])
          .limit(1);

        const dupSnap = await transaction.get(dupQuery);
        if (!dupSnap.empty) {
          throw Object.assign(new Error("ALREADY_RESERVED"), { alreadyReserved: true });
        }
      }

      if (!isNewLot && activeLotProgress >= 0.8 && retailerLevel >= 3) {
        throw Object.assign(
          new Error("LEVEL_RESTRICTED"),
          {
            levelRestriction: true,
            currentLevel: retailerLevel,
            lotProgress: Math.round(activeLotProgress * 100),
          }
        );
      }

      const reservationRef = db.collection("reservations").doc();
      txReservationId = reservationRef.id;

      transaction.set(reservationRef, {
        retailerId,
        retailerName,
        retailerEmail,
        retailerAddress: retailerAddressText,
        postalCode: postalCode || null,
        productId,
        productName,
        factoryId,
        factoryName,
        qty: Number(qty),
        shippingMode,
        shippingCostEstimated,
        commission, // ✅ BLOQUE D: 0 placeholder, se calcula al cerrar
        productSubtotal,
        shippingDiscount,
        commissionDiscount,
        streakPointsAtReservation: currentStreak,
        lotId: targetLotRef.id,
        status: "pending_lot",
        paymentLevel: retailerLevel,
        reliabilityScore: retailerScore,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const newAccumulatedQty = currentQty + Number(qty);
      const currentAccumulatedAmount: number = lotSnap.empty ? 0 : (lotSnap.docs[0].data().accumulatedAmount ?? 0);
      const orderAmount = productPrice * Number(qty);
      const newAccumulatedAmount = currentAccumulatedAmount + orderAmount;

      txLotClosed = minimumType === "amount"
        ? newAccumulatedAmount >= minimumValue
        : newAccumulatedQty >= minimumValue;
      txFinalLotId = targetLotRef.id;

      const level1WindowExpiresAt = txLotClosed
        ? new Date(Date.now() + 2 * 60 * 60 * 1000)
        : null;

      if (txLotClosed) {
        console.log(`🔒 Lote ${txFinalLotId} cerrado. Ventana Nivel 1 hasta: ${level1WindowExpiresAt!.toISOString()}`);
      }

      if (isNewLot) {
        transaction.set(targetLotRef, {
          productId,
          factoryId,
          type: lotType,
          minimumOrder: minimumType === "quantity" ? minimumValue : 0,
          minimumType,
          minimumValue,
          minimumIndex,
          accumulatedQty: newAccumulatedQty,
          accumulatedAmount: newAccumulatedAmount,
          status: txLotClosed ? "closed" : "accumulating",
          orders: [],
          orderCreated: false,
          productName,
          productPrice, // ✅ BASE — el ingreso real del vendedor
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          closedAt: txLotClosed ? FieldValue.serverTimestamp() : null,
          level1WindowExpiresAt,
        });
      } else {
        // ✅ FIX MINIMUM ORDER: sincronizar minimumOrder, minimumValue y minimumType
        // del lote con el producto actual. Si el vendedor cambió el mínimo (siempre
        // validado en edit/route.ts >= accumulatedQty), el lote refleja el nuevo valor.
        transaction.update(targetLotRef, {
          accumulatedQty: newAccumulatedQty,
          accumulatedAmount: newAccumulatedAmount,
          minimumOrder: minimumType === "quantity" ? minimumValue : 0,
          minimumValue,
          minimumType,
          status: txLotClosed ? "closed" : "accumulating",
          closedAt: txLotClosed ? FieldValue.serverTimestamp() : null,
          level1WindowExpiresAt,
          updatedAt: FieldValue.serverTimestamp(),
          productName,
          productPrice,
        });
      }
    });

    /* ── 12. RESPUESTA ──────────────────────────────── */
    const level1Rate = 0.09;
    const savingsVsLevel1 = retailerLevel > 1
      ? Math.round(productSubtotal * (effectiveCommissionRate - level1Rate))
      : 0;

    return NextResponse.json({
      success: true,
      reservationId: txReservationId,
      lotId: txFinalLotId,
      lotClosed: txLotClosed,
      commissionRate: Math.round(effectiveCommissionRate * 100),
      shippingDiscountPct: Math.round(shippingDiscount * 100),
      retailerLevel,
      savingsVsLevel1,
      message: shippingMode === "pickup"
        ? txLotClosed
          ? "¡Completaste el lote! Te avisaremos por email en las próximas horas cuando esté listo para pagar."
          : "Lugar reservado. Te avisaremos por email cuando el lote esté listo para pagar."
        : txLotClosed
          ? `¡Completaste el lote! Calculamos los envíos y te mandamos el link de pago a tu email en las próximas horas.`
          : `Lugar reservado. Estamos buscando más compradores en tu zona${postalCode ? ` (${postalCode})` : ""}. Cuando el lote cierre, te mandamos el precio final a tu email.`,
    });
  } catch (error: any) {
    if (error.message === "ALREADY_RESERVED") {
      return NextResponse.json(
        {
          error: "Ya tenés una reserva activa para este producto en este lote.",
          alreadyReserved: true,
        },
        { status: 409 }
      );
    }
    if (error.message === "LEVEL_RESTRICTED") {
      return NextResponse.json(
        {
          error: `Este lote está casi lleno. Solo revendedores de Nivel 1 o 2 pueden unirse en esta etapa. Mejorá tu historial de pagos para acceder.`,
          levelRestriction: true,
          currentLevel: error.currentLevel,
          lotProgress: error.lotProgress,
        },
        { status: 403 }
      );
    }
    console.error("❌ Error en reserve/route.ts:", error);
    return NextResponse.json(
      { error: "Error procesando la reserva. Intentá de nuevo." },
      { status: 500 }
    );
  }
}