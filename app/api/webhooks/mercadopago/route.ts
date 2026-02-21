// app/api/webhooks/mercadopago/route.ts
//
// ✅ MODIFICACIÓN: Se agregó detección de pagos "diferidos" (reservas).
// Cuando MercadoPago confirma un pago cuya metadata contiene "reservationId",
// se actualiza la reserva a "paid" y se crea la orden, sin tocar el lote.
// TODO EL RESTO DEL ARCHIVO ES IDÉNTICO AL ORIGINAL.

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";
import { sendEmail } from "../../../../lib/email/client";
import { getOrCreateOpenLot } from "../../../../lib/lots/getOrCreateOpenLot";
import { FieldValue } from "firebase-admin/firestore";

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || "";

interface OrderMetadata {
  orderType?: "directa" | "fraccionado";
  lotType?: "directa_retiro" | "directa_envio" | "fraccionado_retiro" | "fraccionado_envio";
  productId?: string;
  buyerId?: string;
  factoryId?: string;
  shippingMode?: "pickup" | "factory" | "platform";
  shippingCost?: number;
  originalQty?: number;
  commission?: number;
  lotId?: string;
  MF?: number;
  // ✅ NUEVO: campos para el flujo de reserva diferida
  reservationId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("🔔 Webhook recibido:", JSON.stringify(body, null, 2));

    const secret = req.headers.get("x-signature");
    if (MP_WEBHOOK_SECRET && secret !== MP_WEBHOOK_SECRET) {
      console.warn("⚠️ Secret inválido");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, data, live_mode } = body;

    if (!live_mode || data?.id === "123456" || data?.id === 123456) {
      console.log("🧪 Notificación de prueba detectada - Respondiendo OK");
      return NextResponse.json({
        ok: true,
        message: "Test notification received successfully",
        note: "This is a test notification. No action taken.",
      });
    }

    if (type !== "payment" || !data?.id) {
      console.log("⚠️ Tipo de notificación no soportado o sin ID");
      return NextResponse.json({ ok: true });
    }

    const paymentId = String(data.id);
    console.log("💳 Procesando payment:", paymentId);

    // Verificar si ya fue procesado
    const paymentDocRef = db.collection("payments").doc(paymentId);
    const paymentDoc = await paymentDocRef.get();

    if (paymentDoc.exists) {
      console.log("✅ Payment ya procesado previamente");
      return NextResponse.json({ ok: true, message: "Already processed" });
    }

    // Obtener datos del pago de MercadoPago
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
      throw new Error("MP_ACCESS_TOKEN no configurado");
    }

    console.log("🔍 Consultando MercadoPago API...");
    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      }
    );

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error("❌ Error obteniendo pago de MP:", paymentRes.status, errorText);
      if (paymentRes.status === 404) {
        return NextResponse.json({
          ok: true,
          message: "Payment not found - test notification",
        });
      }
      throw new Error(`Error obteniendo pago de MP: ${paymentRes.status}`);
    }

    const payment = await paymentRes.json();
    console.log("💰 Payment status:", payment.status);
    console.log("💰 Payment amount:", payment.transaction_amount);
    console.log("📦 Payment metadata (RAW):", JSON.stringify(payment.metadata, null, 2));

    if (payment.status !== "approved") {
      console.log(`⏳ Pago no aprobado aún (status: ${payment.status})`);
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // ========================================
    // MANEJAR PAGO DE DESTACADO
    // ========================================
    const rawMeta = payment.metadata || {};
    const rawTipo = rawMeta?.tipo || rawMeta?.tipo;

    if (rawTipo === "destacado") {
      console.log("⭐ Procesando pago de DESTACADO...");

      const featuredType = rawMeta.featuredType || rawMeta.featured_type;
      const featuredItemId = rawMeta.featuredItemId || rawMeta.featured_item_id;
      const featuredDuration = Number(rawMeta.featuredDuration || rawMeta.featured_duration || 7);

      if (!featuredType || !featuredItemId) {
        console.error("❌ Metadata de destacado incompleta:", rawMeta);
        throw new Error("Metadata de destacado incompleta");
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + featuredDuration);

      let itemMetadata: any = {};
      if (featuredType === "product") {
        const productSnap = await db.collection("products").doc(featuredItemId).get();
        if (productSnap.exists) {
          const p = productSnap.data()!;
          itemMetadata = { name: p.name || "Producto", imageUrl: p.imageUrl || "" };
        }
      } else {
        const factorySnap = await db.collection("manufacturers").doc(featuredItemId).get();
        if (factorySnap.exists) {
          const f = factorySnap.data()!;
          itemMetadata = { name: f.businessName || f.name || "Fábrica", imageUrl: f.profileImageUrl || "" };
        }
      }

      let ownerFactoryId = featuredItemId;
      if (featuredType === "product") {
        const pSnap = await db.collection("products").doc(featuredItemId).get();
        if (pSnap.exists) {
          ownerFactoryId = pSnap.data()!.factoryId || featuredItemId;
        }
      }

      const featuredRef = db.collection("featured").doc();
      await featuredRef.set({
        type: featuredType,
        itemId: featuredItemId,
        factoryId: ownerFactoryId,
        duration: featuredDuration,
        startDate: FieldValue.serverTimestamp(),
        endDate,
        paymentId,
        amount: payment.transaction_amount || 0,
        active: true,
        expired: false,
        metadata: itemMetadata,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await paymentDocRef.set({
        paymentId,
        status: payment.status,
        tipo: "destacado",
        featuredType,
        featuredItemId,
        featuredDuration,
        featuredId: featuredRef.id,
        amount: payment.transaction_amount || 0,
        createdAt: FieldValue.serverTimestamp(),
        processed: true,
      });

      console.log("✅ Destacado creado con ID:", featuredRef.id);
      return NextResponse.json({ ok: true, featuredId: featuredRef.id });
    }

    // ========================================
    // PARSEAR Y NORMALIZAR METADATA
    // ========================================
    let metadata = payment.metadata;

    if (typeof metadata === "string") {
      console.log("⚠️ Metadata llegó como string, parseando...");
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error("❌ Error parseando metadata:", e);
        throw new Error("Metadata inválida (no es JSON válido)");
      }
    }

    const normalizedMetadata: OrderMetadata = {
      productId: metadata?.productId || metadata?.product_id,
      buyerId: metadata?.buyerId || metadata?.retailerId || metadata?.retailer_id,
      factoryId: metadata?.factoryId || metadata?.factory_id,
      originalQty:
        typeof metadata?.originalQty === "string"
          ? parseFloat(metadata.originalQty)
          : typeof metadata?.original_qty === "string"
          ? parseFloat(metadata.original_qty)
          : metadata?.originalQty ||
            metadata?.original_qty ||
            (typeof metadata?.qty === "string"
              ? parseFloat(metadata.qty)
              : metadata?.qty),
      MF:
        typeof metadata?.MF === "string"
          ? parseFloat(metadata.MF)
          : typeof metadata?.mf === "string"
          ? parseFloat(metadata.mf)
          : metadata?.MF || metadata?.mf,
      commission:
        typeof metadata?.commission === "string"
          ? parseFloat(metadata.commission)
          : metadata?.commission,
      shippingCost:
        typeof metadata?.shippingCost === "string"
          ? parseFloat(metadata.shippingCost)
          : typeof metadata?.shipping_cost === "string"
          ? parseFloat(metadata.shipping_cost)
          : metadata?.shippingCost || metadata?.shipping_cost,
      shippingMode: metadata?.shippingMode || metadata?.shipping_mode,
      orderType: metadata?.orderType || metadata?.order_type || metadata?.tipo,
      lotType: metadata?.lotType || metadata?.lot_type,
      lotId: metadata?.lotId || metadata?.lot_id,
      // ✅ NUEVO
      reservationId: metadata?.reservationId || metadata?.reservation_id,
    };

    console.log("✅ Metadata normalizada:", JSON.stringify(normalizedMetadata, null, 2));

    // ============================================================
    // ✅ NUEVO: DETECTAR PAGO DE RESERVA DIFERIDA
    // Si la metadata incluye "reservationId", es un pago que viene
    // del email que se mandó al cerrar el lote. El flujo es distinto:
    // no crea ni actualiza lotes — solo marca la reserva como pagada
    // y registra el pago.
    // ============================================================
    if (normalizedMetadata.reservationId) {
      console.log(
        "🔔 Pago de RESERVA DIFERIDA detectado. reservationId:",
        normalizedMetadata.reservationId
      );

      const reservationRef = db
        .collection("reservations")
        .doc(normalizedMetadata.reservationId);
      const reservationSnap = await reservationRef.get();

      if (!reservationSnap.exists) {
        console.error("❌ Reserva no encontrada:", normalizedMetadata.reservationId);
        throw new Error(`Reserva ${normalizedMetadata.reservationId} no encontrada`);
      }

      const reservation = reservationSnap.data()!;

      // Idempotencia: si ya fue pagada, ignorar
      if (reservation.status === "paid") {
        console.log("✅ Reserva ya marcada como pagada previamente");
        return NextResponse.json({ ok: true, message: "Already paid" });
      }

      // ── 1. Marcar reserva como pagada ──
      await reservationRef.update({
        status: "paid",
        paidAt: FieldValue.serverTimestamp(),
        paymentId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ── 2. Guardar pago en "payments" ──
      await paymentDocRef.set({
        paymentId,
        status: payment.status,
        retailerId: reservation.retailerId,
        buyerId: reservation.retailerId,
        factoryId: reservation.factoryId,
        factoryName: reservation.factoryName,
        productId: reservation.productId,
        productName: reservation.productName,
        qty: reservation.qty,
        orderType: "fraccionado",
        lotType: reservation.shippingMode === "pickup" ? "fraccionado_retiro" : "fraccionado_envio",
        type: "fractional",
        lotStatus: "closed",
        lotId: reservation.lotId || null,
        reservationId: normalizedMetadata.reservationId,
        amount: reservation.productSubtotal || 0,
        shippingCost: reservation.shippingCostFinal || 0,
        total: payment.transaction_amount || 0,
        createdAt: FieldValue.serverTimestamp(),
        processed: true,
        isDeferredPayment: true,
      });

      // ── 3. Crear orden ──
      const orderRef = db.collection("orders").doc();
      await orderRef.set({
        id: orderRef.id,
        paymentId,
        buyerId: reservation.retailerId,
        factoryId: reservation.factoryId,
        productId: reservation.productId,
        productName: reservation.productName,
        qty: reservation.qty,
        unitPrice: reservation.productSubtotal / reservation.qty,
        totalPrice: payment.transaction_amount || 0,
        commission: reservation.commission || 0,
        shippingMode: reservation.shippingMode,
        shippingCost: reservation.shippingCostFinal || 0,
        orderType: "fraccionado",
        lotType: reservation.shippingMode === "pickup" ? "fraccionado_retiro" : "fraccionado_envio",
        lotId: reservation.lotId || null,
        status: "pendiente",
        isDeferredPayment: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log("✅ Pago de reserva diferida procesado. Orden creada:", orderRef.id);

      // ── 4. Email de confirmación al comprador ──
      try {
        const buyerEmail = reservation.retailerEmail || "";
        if (buyerEmail) {
          const shippingFinal = reservation.shippingCostFinal || 0;
          const isPickup = reservation.shippingMode === "pickup";
          const confirmHtml = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;}
  .container{background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:3px solid #10b981;padding-bottom:20px;margin-bottom:30px;}
  .header h1{color:#10b981;margin:0;font-size:24px;}
  .section{margin:25px 0;padding:20px;background:#f9fafb;border-radius:6px;border-left:4px solid #10b981;}
  .row{margin:10px 0;}.label{font-weight:600;color:#6b7280;}.value{font-weight:600;color:#111827;}
  .success{background:#d1fae5;border:2px solid #10b981;border-radius:6px;padding:15px;margin:20px 0;text-align:center;}
  .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;}
</style></head><body><div class="container">
  <div class="header"><h1>✅ ¡Pago confirmado!</h1></div>
  <div class="success"><strong>Tu compra está confirmada</strong></div>
  <p>¡Hola <strong>${reservation.retailerName}</strong>! Tu pago fue procesado correctamente.</p>
  <div class="section">
    <h3 style="margin-top:0;">📦 Tu pedido</h3>
    <div class="row"><span class="label">Producto:</span> <span class="value">${reservation.productName}</span></div>
    <div class="row"><span class="label">Cantidad:</span> <span class="value">${reservation.qty} unidades</span></div>
    <div class="row"><span class="label">Total pagado:</span> <span class="value">$${(payment.transaction_amount || 0).toLocaleString("es-AR")}</span></div>
    <div class="row"><span class="label">Envío:</span> <span class="value">${isPickup ? "Retiro en fábrica" : `$${shippingFinal.toLocaleString("es-AR")}`}</span></div>
  </div>
  <div class="section">
    <h3 style="margin-top:0;">⏰ Próximos pasos</h3>
    <ol style="margin:15px 0;padding-left:20px;">
      <li>${isPickup ? "El fabricante preparará tu pedido para retiro" : "Coordinaremos la entrega a tu dirección"}</li>
      <li>Te contactaremos pronto con los detalles</li>
    </ol>
  </div>
  <div class="footer"><p><strong>Mayorista Móvil</strong></p></div>
</div></body></html>`;

          await sendEmail({
            to: buyerEmail,
            subject: `✅ Pago confirmado — ${reservation.productName}`,
            html: confirmHtml,
          });
          console.log("✅ Email de confirmación enviado al comprador:", buyerEmail);
        }
      } catch (emailErr) {
        console.error("❌ Error enviando email de confirmación al comprador:", emailErr);
      }

      // ── 5. Verificar si TODOS los compradores del lote ya pagaron ──
      //
      // Buscamos cuántas reservas del mismo lote todavía están en "lot_closed"
      // (es decir, sin pagar). Si el resultado es 0 → todos pagaron.
      //
      // ✅ ESTE ES EL PUNTO CORRECTO para notificar al fabricante:
      //    NO cuando cierra el lote (porque los pagos aún no llegaron),
      //    SINO cuando el último comprador paga.
      //
      // El pago al fabricante en MercadoPago ya se libera automáticamente
      // cuando cada comprador paga su preferencia individual (split payment).
      // No hay que "liberar" nada manualmente desde acá.
      if (reservation.lotId) {
        try {
          const pendingSnap = await db
            .collection("reservations")
            .where("lotId", "==", reservation.lotId)
            .where("status", "==", "lot_closed")
            .get();

          const allPaid = pendingSnap.empty;
          console.log(
            `💰 Lote ${reservation.lotId}: quedan ${pendingSnap.size} reservas sin pagar. allPaid=${allPaid}`
          );

          if (allPaid) {
            // Marcar el lote como fully_paid
            await db.collection("lots").doc(reservation.lotId).update({
              status: "fully_paid",
              fullyPaidAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`✅ Lote ${reservation.lotId} marcado como fully_paid`);

            // Obtener datos del fabricante para notificarle
            const factorySnap = await db
              .collection("manufacturers")
              .doc(reservation.factoryId)
              .get();
            const factoryData = factorySnap.data();
            const factoryEmail = factoryData?.email || "";
            const factoryName = factoryData?.businessName || factoryData?.name || "Fabricante";
            const factoryAddress = factoryData?.address?.formattedAddress || "";
            const isPickupLot = reservation.shippingMode === "pickup";

            // Obtener TODAS las reservas pagadas del lote para armar el resumen
            const allPaidSnap = await db
              .collection("reservations")
              .where("lotId", "==", reservation.lotId)
              .where("status", "==", "paid")
              .get();

            // Calcular totales del lote
            let totalUnidades = 0;
            const retailers: { name: string; qty: number; address: string; total: number }[] = [];

            allPaidSnap.docs.forEach((d) => {
              const r = d.data();
              totalUnidades += r.qty || 0;
              retailers.push({
                name: r.retailerName || "Comprador",
                qty: r.qty || 0,
                address: r.retailerAddress || "Dirección no disponible",
                total: r.totalFinal || 0,
              });
            });

            if (factoryEmail) {
              const retailersHtml = retailers
                .map(
                  (r) => `
                <div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:15px;margin:10px 0;">
                  <div style="font-weight:bold;margin-bottom:8px;">${r.name}</div>
                  <div>• Cantidad: ${r.qty} unidades</div>
                  <div>• Dirección: ${r.address}</div>
                  <div>• Total pagado: $${r.total.toLocaleString("es-AR")}</div>
                </div>`
                )
                .join("");

              const factoryHtml = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;}
  .container{background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:3px solid #10b981;padding-bottom:20px;margin-bottom:30px;}
  .header h1{color:#10b981;margin:0;font-size:24px;}
  .section{margin:25px 0;padding:20px;background:#f9fafb;border-radius:6px;border-left:4px solid #10b981;}
  .info-row{margin:10px 0;}.label{font-weight:600;color:#6b7280;}.value{font-weight:600;color:#111827;}
  .warning{background:#fef3c7;border:2px solid #f59e0b;border-radius:6px;padding:15px;margin:20px 0;}
  .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;}
</style></head><body><div class="container">
  <div class="header"><h1>✅ Lote Fraccionado Completado — Todos Pagaron</h1></div>
  <p>¡Felicitaciones <strong>${factoryName}</strong>!</p>
  <p>Todos los compradores del lote de <strong>${reservation.productName}</strong> han completado sus pagos. El lote está listo para ser despachado.</p>
  <div class="section">
    <h3 style="margin-top:0;">📦 Resumen del Lote</h3>
    <div class="info-row"><span class="label">Producto:</span> <span class="value">${reservation.productName}</span></div>
    <div class="info-row"><span class="label">Cantidad Total:</span> <span class="value">${totalUnidades} unidades</span></div>
    <div class="info-row"><span class="label">Compradores:</span> <span class="value">${retailers.length}</span></div>
    <div class="info-row"><span class="label">Tipo:</span> <span class="value">Compra fraccionada — todos los pagos recibidos</span></div>
  </div>
  <div class="section">
    <h3 style="margin-top:0;">📋 Distribución por Revendedor</h3>
    ${retailersHtml}
  </div>
  <div class="section">
    <h3 style="margin-top:0;">🚚 Logística</h3>
    ${isPickupLot
      ? `<p><strong>Modalidad:</strong> RETIRO EN FÁBRICA</p>
        <div class="warning">
          <strong>⏰ IMPORTANTE:</strong> Los revendedores se comunicarán para coordinar el retiro.<br><br>
          Asegurate de tener la mercadería preparada en tus horarios de atención.
        </div>`
      : `<p><strong>Modalidad:</strong> ENVÍO POR PLATAFORMA</p>
        <ol style="margin:15px 0;padding-left:20px;">
          <li>Preparar ${totalUnidades} unidades separadas por revendedor</li>
          <li>Punto de entrega de la plataforma: ${factoryAddress}</li>
          <li>Te contactaremos para coordinar el retiro</li>
        </ol>`
    }
  </div>
  <div class="footer">
    <p><strong>Mayorista Móvil</strong></p>
    <p>Tu plataforma mayorista de confianza</p>
    <p style="font-size:12px;color:#9ca3af;margin-top:10px;">ID de lote: ${reservation.lotId}</p>
  </div>
</div></body></html>`;

              await sendEmail({
                to: factoryEmail,
                subject: `✅ Lote Completado — ${reservation.productName} (${totalUnidades} unidades, ${retailers.length} compradores)`,
                html: factoryHtml,
              });
              console.log("✅ Email al fabricante enviado:", factoryEmail);
            }
          }
        } catch (allPaidErr) {
          console.error("❌ Error verificando/notificando todos-pagaron:", allPaidErr);
          // No lanzar — el pago del comprador ya fue procesado correctamente
        }
      }

      return NextResponse.json({ ok: true, orderId: orderRef.id });
    }

    // ============================================================
    // FLUJO ORIGINAL — exactamente igual que antes
    // (pagos directos y fraccionados normales sin reservationId)
    // ============================================================
    const {
      orderType,
      lotType,
      productId,
      buyerId,
      factoryId,
      shippingMode,
      shippingCost = 0,
      originalQty = 1,
      commission = 0,
      MF = 0,
    } = normalizedMetadata;

    let { lotId } = normalizedMetadata;

    const missingFields: string[] = [];
    if (!productId) missingFields.push("productId");
    if (!buyerId) missingFields.push("buyerId");
    if (!factoryId) missingFields.push("factoryId");

    if (missingFields.length > 0) {
      console.error("❌ Campos faltantes:", missingFields);
      throw new Error(
        `Metadata incompleta. Campos faltantes: ${missingFields.join(", ")}`
      );
    }

    if (!productId || !buyerId || !factoryId) {
      throw new Error("Error de validación interno");
    }

    console.log("✅ Metadata válida:", { productId, buyerId, factoryId, orderType });

    // 1) OBTENER DATOS NECESARIOS
    console.log("📚 Obteniendo datos de Firestore...");

    const productDoc = await db.collection("products").doc(productId!).get();
    if (!productDoc.exists) {
      throw new Error(`Producto ${productId} no encontrado`);
    }
    const productData = productDoc.data()!;
    const productName = productData.name || "Producto sin nombre";
    const productPrice = productData.price || 0;

    const buyerDoc = await db.collection("users").doc(buyerId!).get();
    let buyerEmail = "";
    let buyerName = "Usuario";
    if (buyerDoc.exists) {
      const buyerData = buyerDoc.data();
      buyerEmail = buyerData?.email || "";
      buyerName = buyerData?.name || buyerData?.email || "Usuario";
    }

    const retailerDoc = await db.collection("retailers").doc(buyerId!).get();
    let buyerAddress = "Dirección no disponible";
    let buyerPhone = "";
    if (retailerDoc.exists) {
      const retailerData = retailerDoc.data();
      buyerAddress =
        retailerData?.address?.formatted || "Dirección no disponible";
      buyerPhone = retailerData?.phone || "";
    }

    const factoryDoc = await db
      .collection("manufacturers")
      .doc(factoryId!)
      .get();
    let factoryEmail = "";
    let factoryName = "Fabricante";
    let factoryAddress = "Dirección no disponible";
    let factorySchedule = null;

    if (factoryDoc.exists) {
      const factoryData = factoryDoc.data();
      factoryName =
        factoryData?.businessName || factoryData?.name || "Fabricante";
      factoryAddress =
        factoryData?.address?.formatted || "Dirección no disponible";
      factorySchedule = factoryData?.schedule || null;

      const factoryUserId = factoryData?.userId;
      if (factoryUserId) {
        const factoryUserDoc = await db
          .collection("users")
          .doc(factoryUserId)
          .get();
        if (factoryUserDoc.exists) {
          factoryEmail = factoryUserDoc.data()?.email || "";
        }
      }
    }

    console.log("📧 Emails encontrados:");
    console.log("  - Revendedor:", buyerEmail || "NO ENCONTRADO");
    console.log("  - Fabricante:", factoryEmail || "NO ENCONTRADO");

    // 2) PROCESAR SEGÚN TIPO Y CREAR/ACTUALIZAR LOTE
    let lotStatus = "accumulating";
    let newCurrentQty = originalQty;
    let minimumQty = MF || productData.minimumOrder || 50;

    if (orderType === "fraccionado") {
      console.log("🧩 Procesando pedido FRACCIONADO...");

      let normalizedLotType: "fractional_pickup" | "fractional_shipping";
      if (lotType === "fraccionado_retiro" || lotType?.includes("pickup")) {
        normalizedLotType = "fractional_pickup";
      } else {
        normalizedLotType = "fractional_shipping";
      }

      console.log(`🔄 lotType normalizado: ${lotType} → ${normalizedLotType}`);

      const lot = await getOrCreateOpenLot({
        productId: productId!,
        factoryId: factoryId!,
        minimumOrder: minimumQty,
        lotType: normalizedLotType,
      });

      lotId = lot.id;
      console.log(`✅ Lote obtenido/creado: ${lotId}`);

      const lotRef = db.collection("lots").doc(lotId);
      const currentQty = (lot as any).accumulatedQty || 0;
      newCurrentQty = currentQty + originalQty;

      await lotRef.update({
        accumulatedQty: newCurrentQty,
        updatedAt: FieldValue.serverTimestamp(),
        productName: productName,
        productPrice: productPrice,
        netProfitPerUnit: productData.netProfitPerUnit || 0,
      });

      console.log(
        `📊 Lote actualizado: ${currentQty} → ${newCurrentQty} / ${minimumQty}`
      );

      await lotRef.collection("participants").doc(buyerId!).set(
        {
          buyerId,
          buyerName,
          buyerAddress,
          buyerPhone,
          qty: originalQty,
          joinedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (newCurrentQty >= minimumQty) {
        console.log("🎉 ¡LOTE COMPLETADO!");

        await lotRef.update({
          status: "closed",
          closedAt: FieldValue.serverTimestamp(),
        });

        lotStatus = "closed";

        const paymentsInLot = await db
          .collection("payments")
          .where("lotId", "==", lotId)
          .get();

        const batch = db.batch();
        paymentsInLot.docs.forEach((doc) => {
          batch.update(doc.ref, { lotStatus: "closed" });
        });
        await batch.commit();
        console.log(
          `✅ Actualizado lotStatus a "closed" para ${paymentsInLot.size} pagos`
        );
      }
    }

    // 3) GUARDAR PAGO
    const cleanMetadata = Object.fromEntries(
      Object.entries(normalizedMetadata).filter(
        ([_, value]) => value !== undefined
      )
    );

    const paymentType =
      orderType === "fraccionado" ? "fractional" : "direct";

    await paymentDocRef.set({
      paymentId,
      status: payment.status,
      retailerId: buyerId,
      buyerId,
      factoryId,
      factoryName: factoryName,
      productId,
      productName: productName,
      productPrice: productPrice,
      netProfitPerUnit: productData.netProfitPerUnit || 0,
      qty: originalQty,
      orderType: orderType,
      lotType: lotType || null,
      type: paymentType,
      lotStatus: lotStatus,
      lotId: lotId || null,
      amount: (payment.transaction_amount || 0) - (shippingCost || 0),
      shippingCost: shippingCost || 0,
      total: payment.transaction_amount || 0,
      createdAt: FieldValue.serverTimestamp(),
      metadata: cleanMetadata,
      processed: true,
    });
    console.log("✅ Pago guardado en Firestore con lotId:", lotId);

    // 4) CREAR ORDEN
    const orderRef = db.collection("orders").doc();
    const orderData = {
      id: orderRef.id,
      paymentId,
      buyerId,
      factoryId,
      productId,
      productName,
      qty: originalQty,
      unitPrice: productPrice,
      totalPrice: payment.transaction_amount || 0,
      commission,
      shippingMode,
      shippingCost,
      orderType,
      lotType,
      lotId: lotId || null,
      status: "pendiente",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await orderRef.set(orderData);
    console.log("✅ Orden creada:", orderRef.id);

    // 5) ENVIAR EMAILS SEGÚN TIPO
    if (orderType === "fraccionado") {
      console.log("📧 Procesando emails para pedido FRACCIONADO...");

      if (buyerEmail) {
        try {
          console.log("📧 Enviando email al revendedor (fraccionado)...");

          const progress = Math.round((newCurrentQty / minimumQty) * 100);
          const remaining = Math.max(0, minimumQty - newCurrentQty);
          const isPickup = shippingMode === "pickup";

          const fractionalOrderHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #10b981; margin: 0; font-size: 24px; }
    .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #10b981; }
    .info-row { margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 600; color: #111827; }
    .progress-bar { background: #e5e7eb; border-radius: 10px; height: 30px; margin: 15px 0; overflow: hidden; }
    .progress-fill { background: linear-gradient(to right, #10b981, #059669); height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; transition: width 0.3s ease; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Pedido Confirmado</h1>
    </div>
    <p>¡Hola ${buyerName}!</p>
    <p>Tu pedido fraccionado fue confirmado exitosamente.</p>
    <div class="section">
      <h3 style="margin-top: 0;">📦 Tu Pedido</h3>
      <div class="info-row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
      <div class="info-row"><span class="label">Cantidad:</span> <span class="value">${originalQty} unidades</span></div>
      <div class="info-row"><span class="label">Monto:</span> <span class="value">$ ${payment.transaction_amount}</span></div>
      <div class="info-row"><span class="label">Tipo:</span> <span class="value">Compra fraccionada</span></div>
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">📊 Progreso del Lote</h3>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%">${progress}%</div>
      </div>
      <div class="info-row"><span class="label">Vendido:</span> <span class="value">${newCurrentQty} / ${minimumQty} unidades</span></div>
      <div class="info-row"><span class="label">Faltan:</span> <span class="value">${remaining} unidades</span></div>
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Envío</h3>
      <p><strong>Modalidad:</strong> ${isPickup ? "🏭 Retiro en fábrica" : "📦 Envío por plataforma"}</p>
      ${
        isPickup
          ? `<p><strong>Dirección:</strong> ${factoryAddress}</p>
        <p><strong>⏰ Importante:</strong> Una vez que el lote se complete, tendrás 48hs hábiles para retirar tu pedido.</p>`
          : `<p>Una vez que el lote se complete, coordinaremos la entrega a tu dirección: <strong>${buyerAddress}</strong></p>`
      }
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Esperá a que el lote se complete (${remaining} unidades restantes)</li>
        <li>Te notificaremos por email cuando esté listo</li>
        <li>${isPickup ? "Coordiná el retiro en la fábrica" : "Recibirás tu pedido en tu dirección"}</li>
      </ol>
    </div>
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">ID de pedido: ${orderRef.id}</p>
    </div>
  </div>
</body>
</html>`;

          const emailResult = await sendEmail({
            to: buyerEmail,
            subject: `✅ Pedido Confirmado - ${productName} (${progress}% completado)`,
            html: fractionalOrderHtml,
          });

          if (emailResult.success) {
            console.log("✅ Email enviado al revendedor:", buyerEmail);
          } else {
            console.error(
              "❌ Error enviando email al revendedor:",
              emailResult.error
            );
          }
        } catch (emailError) {
          console.error(
            "❌ Error enviando email al revendedor:",
            emailError
          );
        }
      }

      if (lotStatus === "closed" && factoryEmail) {
        try {
          console.log("📧 Enviando email al fabricante (lote completado)...");

          const lotRef = db.collection("lots").doc(lotId!);
          const participantsSnap = await lotRef
            .collection("participants")
            .get();
          const retailers = participantsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              name: data.buyerName || "Usuario",
              qty: data.qty || 0,
              address: data.buyerAddress || "Dirección no disponible",
              phone: data.buyerPhone || "",
            };
          });

          const isPickup = shippingMode === "pickup";

          const lotClosedHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #10b981; margin: 0; font-size: 24px; }
    .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #10b981; }
    .info-row { margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 600; color: #111827; }
    .retailer { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 10px 0; }
    .warning { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Lote Fraccionado Completado</h1>
    </div>
    <p>¡Felicitaciones ${factoryName}!</p>
    <p>El lote fraccionado alcanzó el mínimo y está listo para despacho.</p>
    <div class="section">
      <h3 style="margin-top: 0;">📦 Resumen del Lote</h3>
      <div class="info-row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
      <div class="info-row"><span class="label">Cantidad Total:</span> <span class="value">${newCurrentQty} unidades</span></div>
      <div class="info-row"><span class="label">Tipo:</span> <span class="value">Compra fraccionada</span></div>
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">📋 Distribución por Revendedor</h3>
      ${retailers
        .map(
          (r) => `
        <div class="retailer">
          <div style="font-weight: bold; margin-bottom: 8px;">${r.name}</div>
          <div>• Cantidad: ${r.qty} unidades</div>
          <div>• Dirección: ${r.address}</div>
          ${r.phone ? `<div>• Teléfono: ${r.phone}</div>` : ""}
        </div>`
        )
        .join("")}
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Logística</h3>
      ${
        isPickup
          ? `<p><strong>Modalidad:</strong> RETIRO EN FÁBRICA</p>
        <div class="warning">
          <strong>⏰ IMPORTANTE:</strong> Los revendedores tienen 48hs hábiles para retirar desde que realizaron la compra.
          <br><br>Asegurate de tener la mercadería preparada en tus horarios de atención.
        </div>`
          : `<p><strong>Modalidad:</strong> ENVÍO POR PLATAFORMA</p>
        <ol style="margin: 15px 0; padding-left: 20px;">
          <li>Preparar ${newCurrentQty} unidades separadas por revendedor</li>
          <li>Punto de entrega: ${factoryAddress}</li>
          <li>Te contactaremos para coordinar el retiro</li>
        </ol>`
      }
    </div>
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">ID de lote: ${lotId}</p>
    </div>
  </div>
</body>
</html>`;

          const emailResult = await sendEmail({
            to: factoryEmail,
            subject: `✅ Lote Completado - ${productName} (${newCurrentQty} unidades)`,
            html: lotClosedHtml,
          });

          if (emailResult.success) {
            console.log(
              "✅ Email de lote cerrado enviado al fabricante:",
              factoryEmail
            );
          } else {
            console.error(
              "❌ Error enviando email de lote cerrado:",
              emailResult.error
            );
          }
        } catch (emailError) {
          console.error(
            "❌ Error enviando email de lote cerrado:",
            emailError
          );
        }
      }
    } else if (orderType === "directa") {
      console.log("🚀 Procesando pedido DIRECTO...");

      if (buyerEmail) {
        try {
          console.log("📧 Enviando email al revendedor (pedido directo)...");

          const isPickup = shippingMode === "pickup";

          const directOrderRetailerHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 24px; }
    .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #2563eb; }
    .info-row { margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 600; color: #111827; }
    .success-box { background: #d1fae5; border: 2px solid #10b981; border-radius: 6px; padding: 15px; margin: 20px 0; text-align: center; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Pedido Confirmado</h1>
    </div>
    <div class="success-box">
      <h2 style="color: #10b981; margin: 0;">¡Tu pedido fue confirmado!</h2>
    </div>
    <p>¡Hola ${buyerName}!</p>
    <p>Tu pedido directo fue confirmado y el pago procesado exitosamente.</p>
    <div class="section">
      <h3 style="margin-top: 0;">📦 Tu Pedido</h3>
      <div class="info-row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
      <div class="info-row"><span class="label">Cantidad:</span> <span class="value">${originalQty} unidades</span></div>
      <div class="info-row"><span class="label">Monto Total:</span> <span class="value">$ ${payment.transaction_amount}</span></div>
      <div class="info-row"><span class="label">Tipo:</span> <span class="value">Compra directa</span></div>
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">🏭 Fabricante</h3>
      <div class="info-row"><span class="label">Nombre:</span> <span class="value">${factoryName}</span></div>
      <div class="info-row"><span class="label">Dirección:</span> <span class="value">${factoryAddress}</span></div>
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Entrega</h3>
      <p><strong>Modalidad:</strong> ${isPickup ? "🏭 Retiro en fábrica" : "📦 Envío a tu dirección"}</p>
      ${
        isPickup
          ? `<div class="info-row"><span class="label">Dirección de retiro:</span> <span class="value">${factoryAddress}</span></div>
        <p style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <strong>⏰ Importante:</strong> Tenés 48hs hábiles para retirar tu pedido en los horarios de atención de la fábrica.
          ${factorySchedule ? `<br><br><strong>Horarios:</strong> ${JSON.stringify(factorySchedule)}` : ""}
        </p>`
          : `<div class="info-row"><span class="label">Se enviará a:</span> <span class="value">${buyerAddress}</span></div>
        <p style="background: #dbeafe; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
          El fabricante coordinará la entrega contigo próximamente.
        </p>`
      }
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>${isPickup ? "Coordiná el retiro con la fábrica" : "Esperá que el fabricante se contacte para coordinar la entrega"}</li>
        <li>Revisá la mercadería al recibirla</li>
        <li>¡Disfrutá de tu compra mayorista!</li>
      </ol>
    </div>
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">ID de pedido: ${orderRef.id}</p>
    </div>
  </div>
</body>
</html>`;

          const emailResult = await sendEmail({
            to: buyerEmail,
            subject: `✅ Pedido Confirmado - ${productName}`,
            html: directOrderRetailerHtml,
          });

          if (emailResult.success) {
            console.log("✅ Email enviado al revendedor:", buyerEmail);
          } else {
            console.error(
              "❌ Error enviando email al revendedor:",
              emailResult.error
            );
          }
        } catch (emailError) {
          console.error(
            "❌ Error enviando email al revendedor:",
            emailError
          );
        }
      }

      if (factoryEmail) {
        try {
          console.log("📧 Enviando email al fabricante (pedido directo)...");

          const isPickup = shippingMode === "pickup";

          const directOrderHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 24px; }
    .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #2563eb; }
    .info-row { margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-weight: 600; color: #111827; }
    .warning { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Nuevo Pedido Directo</h1>
    </div>
    <p>¡Felicitaciones ${factoryName}!</p>
    <p>Recibiste un nuevo pedido directo confirmado.</p>
    <div class="section">
      <h3 style="margin-top: 0;">📦 Detalles del Pedido</h3>
      <div class="info-row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
      <div class="info-row"><span class="label">Cantidad:</span> <span class="value">${originalQty} unidades</span></div>
      <div class="info-row"><span class="label">Monto:</span> <span class="value">$ ${payment.transaction_amount}</span></div>
      <div class="info-row"><span class="label">Tipo:</span> <span class="value">Compra directa</span></div>
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">👤 Cliente</h3>
      <div class="info-row"><span class="label">Nombre:</span> <span class="value">${buyerName}</span></div>
      <div class="info-row"><span class="label">Dirección:</span> <span class="value">${buyerAddress}</span></div>
      ${buyerPhone ? `<div class="info-row"><span class="label">Teléfono:</span> <span class="value">${buyerPhone}</span></div>` : ""}
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Envío</h3>
      <p><strong>Modalidad:</strong> ${isPickup ? "🏭 Retiro en fábrica" : "📦 Envío por fábrica"}</p>
      ${
        isPickup
          ? `<div class="warning">
          <strong>⏰ IMPORTANTE:</strong> El cliente tiene 48hs hábiles para retirar desde que realizó la compra.
          <br><br>Asegurate de tener la mercadería lista en tus horarios de atención.
        </div>`
          : `<p>Deberás coordinar el envío con el cliente a la dirección: <strong>${buyerAddress}</strong></p>`
      }
    </div>
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Preparar ${originalQty} unidades de ${productName}</li>
        <li>${isPickup ? "Tener la mercadería lista para retiro" : "Coordinar envío con el cliente"}</li>
        <li>El pago ya está acreditado en tu cuenta</li>
      </ol>
    </div>
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">ID de pedido: ${orderRef.id}</p>
    </div>
  </div>
</body>
</html>`;

          const emailResult = await sendEmail({
            to: factoryEmail,
            subject: `🎉 Nuevo Pedido - ${productName} (${originalQty} unidades)`,
            html: directOrderHtml,
          });

          if (emailResult.success) {
            console.log("✅ Email enviado al fabricante:", factoryEmail);
          } else {
            console.error(
              "❌ Error enviando email al fabricante:",
              emailResult.error
            );
          }
        } catch (emailError) {
          console.error(
            "❌ Error enviando email al fabricante:",
            emailError
          );
        }
      }
    }

    console.log("✅ Webhook procesado exitosamente");
    return NextResponse.json({ ok: true, orderId: orderRef.id, lotId });
  } catch (error: any) {
    console.error("❌ Error en webhook:", error);
    console.error("Stack trace:", error.stack);

    return NextResponse.json(
      {
        error: error?.message || "Error procesando webhook",
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}