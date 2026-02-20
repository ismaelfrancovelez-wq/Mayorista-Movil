// app/api/lots/fraccionado/reserve/route.ts
//
// POST  { productId, qty, shippingMode: "pickup" | "platform" }
//
// Guarda una RESERVA sin cobrar. El pago se solicita cuando el lote
// alcanza el mínimo de unidades. En ese momento:
//   1. Agrupa las reservas por código postal
//   2. Calcula cuánto paga de envío cada grupo (dividido entre los del mismo CP)
//   3. Genera un link de MercadoPago personalizado para cada persona
//   4. Manda el email con el link y el precio final
//
// Colección nueva en Firestore: "reservations"
// Campos de cada reserva:
//   retailerId, retailerName, retailerEmail, retailerAddress,
//   postalCode, productId, productName, factoryId, factoryName,
//   qty, shippingMode, shippingCostEstimated (si pagara solo),
//   commission, productSubtotal, lotId,
//   status: "pending_lot" | "notified" | "paid" | "cancelled"

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { calculateFraccionadoShipping } from "../../../../../lib/shipping";
import { sendEmail } from "../../../../../lib/email/client";
import { createSplitPreference } from "../../../../../lib/mercadopago-split";
import rateLimit from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

/* ====================================================
   EXTRAER CÓDIGO POSTAL DEL FORMATTED ADDRESS
   Cubre los formatos argentinos: B1686, C1425, 1686, 7000
==================================================== */
function extractPostalCode(addr: string): string | null {
  if (!addr) return null;
  const alphaMatch = addr.match(/\b([A-Z]\d{4}[A-Z]{0,3})\b/);
  if (alphaMatch) return alphaMatch[1];
  const numMatch = addr.match(/\b(\d{4})\b/);
  if (numMatch) return numMatch[1];
  return null;
}

/* ====================================================
   ENVIAR EMAILS DE PAGO CUANDO EL LOTE CIERRA
   Se llama de forma asincrónica para no bloquear la respuesta
==================================================== */
async function sendPaymentEmailsForClosedLot(params: {
  lotId: string;
  productId: string;
  productName: string;
  factoryId: string;
  factoryName: string;
}) {
  const { lotId, productId, productName, factoryId, factoryName } = params;

  console.log(`📧 Iniciando envío de emails para lote cerrado: ${lotId}`);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://mayoristamovil.com");

  // Obtener el MP user_id del fabricante (para el split de pagos)
  const factorySnap = await db
    .collection("manufacturers")
    .doc(factoryId)
    .get();
  const factoryMPUserId =
    factorySnap.data()?.mercadopago?.user_id || null;

  // Obtener todas las reservas activas del lote
  const reservationsSnap = await db
    .collection("reservations")
    .where("lotId", "==", lotId)
    .where("status", "==", "pending_lot")
    .get();

  if (reservationsSnap.empty) {
    console.warn(`⚠️ No hay reservas pending_lot para lote ${lotId}`);
    return;
  }

  // Separar reservas en grupos por código postal (solo para envío por plataforma)
  // Retiro en fábrica → siempre pagan el costo individual (no hay descuento por zona)
  const shippingGroups: Record<
    string,
    typeof reservationsSnap.docs
  > = {};
  const noGroupDocs: typeof reservationsSnap.docs = [];

  reservationsSnap.docs.forEach((doc) => {
    const r = doc.data();
    if (r.shippingMode === "platform" && r.postalCode) {
      if (!shippingGroups[r.postalCode]) {
        shippingGroups[r.postalCode] = [];
      }
      shippingGroups[r.postalCode].push(doc);
    } else {
      // Retiro o sin código postal → no tiene descuento de zona
      noGroupDocs.push(doc);
    }
  });

  // Procesar todos los grupos y los sin grupo
  const allGroups = [
    ...Object.values(shippingGroups),
    ...(noGroupDocs.length > 0 ? [noGroupDocs] : []),
  ];

  for (const groupDocs of allGroups) {
    // Para el grupo con el mismo CP, el envío se divide entre todos
    // Tomamos el shippingCostEstimated del primero (todos deberían ser similares
    // porque son de la misma zona)
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
      if (!r.retailerEmail) {
        console.warn(`⚠️ Reserva ${reservationDoc.id} sin email, omitiendo`);
        continue;
      }

      const isPickup = r.shippingMode === "pickup";
      const shippingFinal = isPickup ? 0 : shippingPerPerson;
      const totalFinal =
        r.productSubtotal + r.commission + shippingFinal;

      // ─── Generar link de pago personalizado ───────────────────
      let paymentLink = `${baseUrl}/explorar/${productId}`;
      try {
        const productTotal = r.productSubtotal; // sin comisión ni envío
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
            MF: 0, // el lote ya cerró
            shippingCost: shippingFinal,
            shippingMode: r.shippingMode,
            commission: r.commission,
            // Campo especial que distingue este pago del flujo normal
            // El webhook lo detecta y actualiza la reserva en vez de
            // crear un lote nuevo
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
          productTotal,
          commission: r.commission,
        });
        if (preference.init_point) {
          paymentLink = preference.init_point;
        }
      } catch (prefErr) {
        console.error(
          `❌ Error creando preferencia para ${r.retailerEmail}:`,
          prefErr
        );
        // Si falla, el link va a la página del producto igual
      }

      // ─── Armar el HTML del email ──────────────────────────────
      const savingsHtml =
        !isPickup && groupSize > 1
          ? `
        <div style="background:#d1fae5;border:2px solid #10b981;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#065f46;">
            💚 ¡Ahorraste en el envío!
          </p>
          <p style="margin:8px 0 0;color:#047857;font-size:14px;">
            Estás dividiendo el envío con 
            <strong>${groupSize - 1} persona${groupSize - 1 > 1 ? "s" : ""}</strong> 
            de tu misma zona.<br>
            Pagás <strong>$${shippingFinal.toLocaleString("es-AR")}</strong> 
            de envío en vez de 
            <strong>$${(r.shippingCostEstimated || 0).toLocaleString("es-AR")}</strong>.
          </p>
        </div>`
          : "";

      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;}
    .container{background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,.1);}
    .header{text-align:center;border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px;}
    .header h1{color:#2563eb;margin:0;font-size:24px;}
    .section{margin:25px 0;padding:20px;background:#f9fafb;border-radius:6px;border-left:4px solid #2563eb;}
    .row{margin:10px 0;}
    .label{font-weight:600;color:#6b7280;}
    .value{font-weight:600;color:#111827;}
    .cta{display:block;background:#2563eb;color:white;text-align:center;padding:18px 24px;border-radius:8px;text-decoration:none;font-size:18px;font-weight:700;margin:24px 0;}
    .warning{background:#fef3c7;border:2px solid #f59e0b;border-radius:6px;padding:15px;margin:20px 0;}
    .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 ¡Tu lote está listo — completá el pago!</h1>
    </div>

    <p>¡Hola <strong>${r.retailerName}</strong>!</p>
    <p>
      El lote de <strong>${productName}</strong> alcanzó el mínimo de unidades.
      Ahora podés confirmar tu compra con el precio final.
    </p>

    ${savingsHtml}

    <div class="section">
      <h3 style="margin-top:0;">🧾 Tu pedido</h3>
      <div class="row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
      <div class="row"><span class="label">Cantidad:</span> <span class="value">${r.qty} unidades</span></div>
      <div class="row"><span class="label">Subtotal producto:</span> <span class="value">$${r.productSubtotal.toLocaleString("es-AR")}</span></div>
      <div class="row"><span class="label">Comisión (12%):</span> <span class="value">$${r.commission.toLocaleString("es-AR")}</span></div>
      <div class="row">
        <span class="label">Envío:</span>
        <span class="value">
          ${isPickup
            ? "Retiro en fábrica (Gratis)"
            : `$${shippingFinal.toLocaleString("es-AR")}${groupSize > 1 ? ` (compartido entre ${groupSize} compradores de tu zona)` : ""}`
          }
        </span>
      </div>
      <div class="row" style="border-top:2px solid #e5e7eb;padding-top:10px;margin-top:10px;">
        <span class="label" style="font-size:15px;">TOTAL A PAGAR:</span>
        <span class="value" style="font-size:22px;color:#2563eb;">$${totalFinal.toLocaleString("es-AR")}</span>
      </div>
    </div>

    <div class="warning">
      <strong>⏰ Importante:</strong> Tenés <strong>48 horas</strong> para completar el pago.
      Si no pagás dentro de ese plazo, tu reserva se cancelará automáticamente.
    </div>

    <a href="${paymentLink}" class="cta">
      💳 Pagar ahora — $${totalFinal.toLocaleString("es-AR")}
    </a>

    <div class="section">
      <h3 style="margin-top:0;">🏭 Fabricante</h3>
      <div class="row"><span class="label">Empresa:</span> <span class="value">${factoryName}</span></div>
    </div>

    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
    </div>
  </div>
</body>
</html>`;

      try {
        await sendEmail({
          to: r.retailerEmail,
          subject: `💳 ¡Completá tu pago! Lote de ${productName} listo`,
          html,
        });
        console.log(`✅ Email enviado a: ${r.retailerEmail}`);
      } catch (emailErr) {
        console.error(
          `❌ Error enviando email a ${r.retailerEmail}:`,
          emailErr
        );
        // Seguimos con el siguiente — un error no debe bloquear los demás
      }

      // Actualizar la reserva: notificada, con el monto final y el link
      await db
        .collection("reservations")
        .doc(reservationDoc.id)
        .update({
          status: "notified",
          notifiedAt: FieldValue.serverTimestamp(),
          shippingCostFinal: shippingFinal,
          totalFinal,
          paymentLink,
          updatedAt: FieldValue.serverTimestamp(),
        });
    }
  }

  console.log(
    `✅ Emails de pago enviados para lote ${lotId}`
  );
}

/* ====================================================
   HANDLER PRINCIPAL
==================================================== */
export async function POST(req: Request) {
  // Rate limit
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
    /* ── 1. AUTENTICACIÓN ─────────────────────────────── */
    const retailerId = cookies().get("userId")?.value;
    if (!retailerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    /* ── 2. BODY ──────────────────────────────────────── */
    const body = await req.json();
    const { productId, qty, shippingMode } = body;

    if (
      !productId ||
      !qty ||
      Number(qty) <= 0 ||
      !shippingMode ||
      !["pickup", "platform"].includes(shippingMode)
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    /* ── 3. VERIFICAR DIRECCIÓN DEL RETAILER ─────────── */
    // Obligatoria para reservar (sin dirección no hay envío)
    const retailerSnap = await db
      .collection("retailers")
      .doc(retailerId)
      .get();

    let retailerAddressText: string | null = null;
    let postalCode: string | null = null;

    if (retailerSnap.exists) {
      retailerAddressText =
        retailerSnap.data()?.address?.formattedAddress ?? null;
      if (retailerAddressText) {
        postalCode = extractPostalCode(retailerAddressText);
      }
    }

    if (!retailerAddressText) {
      return NextResponse.json(
        {
          error:
            "Configurá tu dirección en tu perfil antes de reservar. La necesitamos para calcular el envío.",
          missingAddress: true,
        },
        { status: 400 }
      );
    }

    /* ── 4. PRODUCTO Y FÁBRICA ────────────────────────── */
    const productSnap = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!productSnap.exists) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const productData = productSnap.data()!;
    const factoryId = productData.factoryId;
    const minimumOrder = productData.minimumOrder || 0;
    const productPrice = productData.price || 0;
    const productName = productData.name || "Producto";
    const productSubtotal = productPrice * qty;
    const commission = Math.round(productSubtotal * 0.12);

    const factorySnap = await db
      .collection("manufacturers")
      .doc(factoryId)
      .get();

    if (!factorySnap.exists) {
      return NextResponse.json(
        { error: "Fábrica no encontrada" },
        { status: 404 }
      );
    }

    const factoryData = factorySnap.data()!;
    const factoryAddressText =
      factoryData.address?.formattedAddress ?? null;
    const factoryName =
      factoryData.businessName || factoryData.name || "Fabricante";

    /* ── 5. CALCULAR COSTO DE ENVÍO ESTIMADO ─────────── */
    // Es el precio que pagaría si fuera solo (puede bajar si hay más
    // compradores en su zona al momento de cerrar el lote)
    let shippingCostEstimated = 0;

    if (shippingMode === "platform" && factoryAddressText) {
      try {
        const result = await calculateFraccionadoShipping({
          factoryAddress: factoryAddressText,
          retailerAddress: retailerAddressText,
        });
        shippingCostEstimated = result.totalCost;
      } catch (err) {
        console.warn("⚠️ No se pudo calcular costo de envío estimado:", err);
        // Continuamos igual — se recalculará cuando cierre el lote
      }
    }

    /* ── 6. OBTENER DATOS DEL RETAILER PARA LA RESERVA ─ */
    const userSnap = await db.collection("users").doc(retailerId).get();
    const retailerName =
      userSnap.data()?.name ||
      userSnap.data()?.email?.split("@")[0] ||
      "Comprador";
    const retailerEmail = userSnap.data()?.email || "";

    /* ── 7. BUSCAR EL LOTE ACTIVO PARA ESTE PRODUCTO ─── */
    // Usamos el índice existente (productId + status) y filtramos
    // por tipo en JavaScript (para evitar nuevos índices compuestos)
    const SHIPPING_TYPES = new Set([
      "fractional_shipping",
      "fraccionado_envio",
    ]);
    const PICKUP_TYPES = new Set([
      "fractional_pickup",
      "fraccionado_retiro",
    ]);
    const targetTypes =
      shippingMode === "pickup" ? PICKUP_TYPES : SHIPPING_TYPES;

    const [accumSnap, openSnap] = await Promise.all([
      db
        .collection("lots")
        .where("productId", "==", productId)
        .where("status", "==", "accumulating")
        .get(),
      db
        .collection("lots")
        .where("productId", "==", productId)
        .where("status", "==", "open")
        .get(),
    ]);

    const allLotDocs = [...accumSnap.docs, ...openSnap.docs];
    const activeLotDoc = allLotDocs.find((d) =>
      targetTypes.has(d.data().type)
    );
    let activeLotId = activeLotDoc ? activeLotDoc.id : null;

    /* ── 8. VERIFICAR RESERVA DUPLICADA ──────────────── */
    if (activeLotId) {
      const dupSnap = await db
        .collection("reservations")
        .where("retailerId", "==", retailerId)
        .where("lotId", "==", activeLotId)
        .where("status", "==", "pending_lot")
        .limit(1)
        .get();

      if (!dupSnap.empty) {
        return NextResponse.json(
          {
            error: "Ya tenés una reserva activa para este producto en este lote.",
            alreadyReserved: true,
          },
          { status: 409 }
        );
      }
    }

    /* ── 9. GUARDAR LA RESERVA ───────────────────────── */
    const reservationRef = db.collection("reservations").doc();

    await reservationRef.set({
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
      commission,
      productSubtotal,
      lotId: activeLotId, // null si no hay lote aún (se actualiza abajo)
      status: "pending_lot",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    /* ── 10. ACTUALIZAR / CREAR EL LOTE ─────────────── */
    const lotType =
      shippingMode === "pickup"
        ? "fractional_pickup"
        : "fractional_shipping";
    let lotClosed = false;
    let finalLotId: string;

    if (activeLotDoc) {
      // Lote existente — sumar cantidad
      finalLotId = activeLotDoc.id;
      const currentQty = activeLotDoc.data().accumulatedQty || 0;
      const newQty = currentQty + Number(qty);
      lotClosed = newQty >= minimumOrder;

      await db
        .collection("lots")
        .doc(finalLotId)
        .update({
          accumulatedQty: newQty,
          status: lotClosed ? "closed" : "accumulating",
          closedAt: lotClosed ? FieldValue.serverTimestamp() : null,
          updatedAt: FieldValue.serverTimestamp(),
          productName,
          productPrice,
        });

      console.log(
        `📦 Lote ${finalLotId}: ${currentQty} → ${newQty}/${minimumOrder}` +
          (lotClosed ? " ¡CERRADO!" : "")
      );
    } else {
      // No hay lote activo — crear uno nuevo
      const newLotRef = db.collection("lots").doc();
      finalLotId = newLotRef.id;
      lotClosed = Number(qty) >= minimumOrder;

      await newLotRef.set({
        productId,
        factoryId,
        type: lotType,
        minimumOrder,
        accumulatedQty: Number(qty),
        status: lotClosed ? "closed" : "accumulating",
        orders: [],
        orderCreated: false,
        productName,
        productPrice,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        closedAt: lotClosed ? FieldValue.serverTimestamp() : null,
      });

      console.log(
        `📦 Nuevo lote creado: ${finalLotId} (${qty}/${minimumOrder})` +
          (lotClosed ? " ¡CERRADO!" : "")
      );
    }

    // Actualizar la reserva con el lotId final
    await reservationRef.update({
      lotId: finalLotId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    /* ── 11. SI EL LOTE CERRÓ → ENVIAR EMAILS ────────── */
    if (lotClosed) {
      console.log(
        `🎉 Lote ${finalLotId} cerrado. Enviando emails de pago...`
      );
      // No usamos await para no bloquear la respuesta al usuario
      // Los errores se loguean internamente
      sendPaymentEmailsForClosedLot({
        lotId: finalLotId,
        productId,
        productName,
        factoryId,
        factoryName,
      }).catch((err) =>
        console.error("❌ Error en sendPaymentEmailsForClosedLot:", err)
      );
    }

    /* ── 12. RESPONDER ───────────────────────────────── */
    return NextResponse.json({
      success: true,
      reservationId: reservationRef.id,
      lotId: finalLotId,
      message:
        shippingMode === "pickup"
          ? "Lugar reservado. Te avisaremos por email cuando el lote esté listo para pagar."
          : `Lugar reservado. Estamos buscando más compradores en tu zona${postalCode ? ` (${postalCode})` : ""} para dividir el envío. Cuando el lote cierre, te mandamos el precio final a tu email.`,
    });
  } catch (error: any) {
    console.error("❌ Error en reserve/route.ts:", error);
    return NextResponse.json(
      { error: "Error procesando la reserva. Intentá de nuevo." },
      { status: 500 }
    );
  }
}