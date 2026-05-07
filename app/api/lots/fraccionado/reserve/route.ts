// app/api/lots/fraccionado/reserve/route.ts
//
// REFACTOR: eliminado todo el sistema de niveles del retailer.
// Eliminado el cálculo de comisión (4% MP). Eliminados los descuentos
// de envío por racha. Eliminada la ventana de 2h post-cierre.
// Eliminada la restricción de Nivel 3-4 al 80% del lote.
//
// El cliente ahora elige método de pago al pagar (en /pagar/[reservationId]).
// Acá solo creamos la reserva con productSubtotal limpio.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { calculateFraccionadoShipping } from "../../../../../lib/shipping";
import { sendEmail } from "../../../../../lib/email/client";
import rateLimit from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

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
   Cambios vs versión anterior:
   - No calcula commission (ya no hay 4%)
   - No aplica shippingDiscount (ya no hay descuentos)
   - Total = productSubtotal + shippingFinal (sin comisión)
   - El email apunta a /pagar/[reservationId] (no al init_point de MP)
==================================================== */
async function processLotClosure(params: {
  lotId: string;
  productId: string;
  productName: string;
  factoryId: string;
  factoryName: string;
}) {
  const { lotId, productId, productName } = params;
  console.log(`🔒 Procesando cierre de lote: ${lotId}`);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://mayoristamovil.com");

  const reservationsSnap = await db
    .collection("reservations")
    .where("lotId", "==", lotId)
    .where("status", "==", "pending_lot")
    .get();

  if (reservationsSnap.empty) {
    console.warn(`⚠️ No hay reservas pending_lot para lote ${lotId}`);
    return;
  }

  // Agrupar por código postal (para dividir envío entre vecinos)
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
      const productSubtotal = r.productSubtotal || 0;
      const shippingFinal = isPickup ? 0 : shippingPerPerson;

      // ✅ Total LIMPIO sin comisión transaccional
      const totalFinal = productSubtotal + shippingFinal;

      // Link al selector de pago (/pagar/[reservationId])
      const paymentLink = `${baseUrl}/pagar/${reservationDoc.id}`;

      await db.collection("reservations").doc(reservationDoc.id).update({
        status: "lot_closed",
        lotClosedAt: FieldValue.serverTimestamp(),
        shippingCostFinal: shippingFinal,
        totalFinal,
        paymentLink,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ── Email ──
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
  .info{background:#dbeafe;border:1px solid #93c5fd;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#1e40af;}
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
  <div class="row" style="border-top:2px solid #e5e7eb;padding-top:10px;margin-top:10px;">
    <span class="label" style="font-size:15px;">TOTAL A PAGAR:</span>
    <span class="value" style="font-size:22px;color:#2563eb;">$${totalFinal.toLocaleString("es-AR")}</span>
  </div>
  <div class="info">
    💡 <strong>Elegí cómo pagar:</strong> en el siguiente paso podés pagar con QR (más barato), tarjeta o transferencia. Cada método tiene un recargo distinto y vos elegís.
  </div>
  <div class="warning"><strong>⏰ Importante:</strong> Tenés <strong>48 horas</strong> para completar el pago o tu reserva se cancelará.</div>
  <a href="${paymentLink}" class="cta">💳 Elegir método y pagar</a>
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
    /* ── 1. AUTH ── */
    const retailerId = cookies().get("userId")?.value;
    if (!retailerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    /* ── 2. BODY ── */
    const body = await req.json();
    const { productId, qty, shippingMode, paymentMethod } = body;
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
    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Falta el método de pago" },
        { status: 400 }
      );
    }

    /* ── 3. DIRECCIÓN DEL RETAILER ── */
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

    /* ── 4. PRODUCTO Y FÁBRICA ── */
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
      productPrice = selFmt?.price ?? productData.price ?? 0;
      minimumType = selMin?.type === "amount" ? "amount" : "quantity";
      minimumValue = selMin?.value ?? productData.minimumOrder ?? 0;
      minimumOrder = minimumType === "quantity" ? minimumValue : productData.minimumOrder || 1;
    } else {
      productPrice = productData.price || 0;
      minimumValue = productData.minimumOrder || 0;
      minimumOrder = minimumValue;
    }

    if (!minimumValue || minimumValue <= 0) {
      return NextResponse.json(
        { error: "Este producto no tiene un mínimo de compra configurado." },
        { status: 400 }
      );
    }
    const productSubtotal = productPrice * Number(qty);

    const factorySnap = await db.collection("manufacturers").doc(factoryId).get();
    if (!factorySnap.exists) {
      return NextResponse.json({ error: "Fábrica no encontrada" }, { status: 404 });
    }
    const factoryData = factorySnap.data()!;
    const factoryAddressText = factoryData.address?.formattedAddress ?? null;
    const factoryName =
      factoryData.businessName || factoryData.name || "Fabricante";

    /* ── 5. ENVÍO ESTIMADO ── */
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

    /* ── 6. DATOS DEL RETAILER ── */
    const userSnap = await db.collection("users").doc(retailerId).get();
    const retailerName =
      userSnap.data()?.name ||
      userSnap.data()?.email?.split("@")[0] ||
      "Comprador";
    const retailerEmail = userSnap.data()?.email || "";

    /* ── 7. TRANSACCIÓN ATÓMICA ── */
    const SHIPPING_TYPES = new Set(["fractional_shipping", "fraccionado_envio"]);
    const PICKUP_TYPES = new Set(["fractional_pickup", "fraccionado_retiro"]);
    const lotType =
      shippingMode === "pickup" ? "fractional_pickup" : "fractional_shipping";

    let txReservationId: string = "";
    let txFinalLotId: string = "";
    let txLotClosed: boolean = false;

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

      if (lotSnap.empty) {
        targetLotRef = db.collection("lots").doc();
        isNewLot = true;
      } else {
        targetLotRef = lotSnap.docs[0].ref;
        currentQty = lotSnap.docs[0].data().accumulatedQty || 0;
      }

      // Anti-duplicado dentro del mismo lote
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
        productSubtotal,
        lotId: targetLotRef.id,
        status: "pending_lot",
        paymentMethod,
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
          productPrice,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          closedAt: txLotClosed ? FieldValue.serverTimestamp() : null,
        });
      } else {
        transaction.update(targetLotRef, {
          accumulatedQty: newAccumulatedQty,
          accumulatedAmount: newAccumulatedAmount,
          minimumOrder: minimumType === "quantity" ? minimumValue : 0,
          minimumValue,
          minimumType,
          status: txLotClosed ? "closed" : "accumulating",
          closedAt: txLotClosed ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp(),
          productName,
          productPrice,
        });
      }
    });

    /* ── 8. SI EL LOTE CERRÓ, PROCESAR EMAILS ── */
    if (txLotClosed) {
      try {
        await processLotClosure({
          lotId: txFinalLotId,
          productId,
          productName,
          factoryId,
          factoryName,
        });
      } catch (closeErr) {
        console.error("❌ Error en processLotClosure (no crítico):", closeErr);
      }
    }

    /* ── 9. RESPUESTA ── */
    return NextResponse.json({
      success: true,
      reservationId: txReservationId,
      lotId: txFinalLotId,
      lotClosed: txLotClosed,
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
    console.error("❌ Error en reserve/route.ts:", error);
    return NextResponse.json(
      { error: "Error procesando la reserva. Intentá de nuevo." },
      { status: 500 }
    );
  }
}