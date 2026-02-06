// app/api/webhooks/mercadopago/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";
import { sendEmail } from "../../../../lib/email/client";

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
    
    // ========================================
    // MANEJAR NOTIFICACIONES DE PRUEBA
    // ========================================
    if (!live_mode || data?.id === "123456" || data?.id === 123456) {
      console.log("🧪 Notificación de prueba detectada - Respondiendo OK");
      return NextResponse.json({ 
        ok: true, 
        message: "Test notification received successfully",
        note: "This is a test notification. No action taken."
      });
    }

    if (type !== "payment" || !data?.id) {
      console.log("⚠️ Tipo de notificación no soportado o sin ID");
      return NextResponse.json({ ok: true });
    }

    const paymentId = String(data.id);
    console.log("💳 Procesando payment:", paymentId);

    // ========================================
    // VERIFICAR SI YA FUE PROCESADO
    // ========================================
    const paymentDocRef = db.collection("payments").doc(paymentId);
    const paymentDoc = await paymentDocRef.get();

    if (paymentDoc.exists) {
      console.log("✅ Payment ya procesado previamente");
      return NextResponse.json({ ok: true, message: "Already processed" });
    }

    // ========================================
    // OBTENER DATOS DEL PAGO DE MERCADOPAGO
    // ========================================
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
      throw new Error("MP_ACCESS_TOKEN no configurado");
    }

    console.log("🔍 Consultando MercadoPago API...");
    const paymentRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error("❌ Error obteniendo pago de MP:", paymentRes.status, errorText);
      
      // Si es 404, el pago no existe (probablemente una notificación de prueba)
      if (paymentRes.status === 404) {
        console.log("⚠️ Pago no encontrado en MP - Probablemente notificación de prueba");
        return NextResponse.json({ 
          ok: true, 
          message: "Payment not found - test notification" 
        });
      }
      
      throw new Error(`Error obteniendo pago de MP: ${paymentRes.status}`);
    }

    const payment = await paymentRes.json();
    console.log("💰 Payment status:", payment.status);
    console.log("💰 Payment amount:", payment.transaction_amount);
    console.log("📦 Payment metadata:", JSON.stringify(payment.metadata, null, 2));

    // ========================================
    // SOLO PROCESAR PAGOS APROBADOS
    // ========================================
    if (payment.status !== "approved") {
      console.log(`⏳ Pago no aprobado aún (status: ${payment.status})`);
      return NextResponse.json({ ok: true, status: payment.status });
    }

    // ========================================
    // VALIDAR METADATA
    // ========================================
    const metadata = payment.metadata as OrderMetadata;
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
      lotId,
      MF = 0,
    } = metadata;

    if (!productId || !buyerId || !factoryId) {
      console.error("❌ Metadata incompleta:", metadata);
      throw new Error("Metadata incompleta en payment");
    }

    console.log("✅ Metadata válida:", { productId, buyerId, factoryId, orderType });

    // ========================================
    // 1) OBTENER DATOS NECESARIOS
    // ========================================
    
    console.log("📚 Obteniendo datos de Firestore...");
    
    // Producto
    const productDoc = await db.collection("products").doc(productId).get();
    if (!productDoc.exists) {
      throw new Error(`Producto ${productId} no encontrado`);
    }
    const productData = productDoc.data()!;
    const productName = productData.name || "Producto sin nombre";
    const productPrice = productData.price || 0;

    // Comprador (Revendedor)
    const buyerDoc = await db.collection("users").doc(buyerId).get();
    let buyerEmail = "";
    let buyerName = "Usuario";
    if (buyerDoc.exists) {
      const buyerData = buyerDoc.data();
      buyerEmail = buyerData?.email || "";
      buyerName = buyerData?.name || buyerData?.email || "Usuario";
    }

    // Dirección del revendedor
    const retailerDoc = await db.collection("retailers").doc(buyerId).get();
    let buyerAddress = "Dirección no disponible";
    let buyerPhone = "";
    if (retailerDoc.exists) {
      const retailerData = retailerDoc.data();
      buyerAddress = retailerData?.address?.formatted || "Dirección no disponible";
      buyerPhone = retailerData?.phone || "";
    }

    // Fabricante
    const factoryDoc = await db.collection("manufacturers").doc(factoryId).get();
    let factoryEmail = "";
    let factoryName = "Fabricante";
    let factoryAddress = "Dirección no disponible";
    let factorySchedule = null;
    
    if (factoryDoc.exists) {
      const factoryData = factoryDoc.data();
      factoryName = factoryData?.businessName || factoryData?.name || "Fabricante";
      factoryAddress = factoryData?.address?.formatted || "Dirección no disponible";
      factorySchedule = factoryData?.schedule || null;
      
      // Buscar email del usuario del fabricante
      const factoryUserId = factoryData?.userId;
      if (factoryUserId) {
        const factoryUserDoc = await db.collection("users").doc(factoryUserId).get();
        if (factoryUserDoc.exists) {
          const factoryUserData = factoryUserDoc.data();
          factoryEmail = factoryUserData?.email || "";
        }
      }
    }

    console.log("📧 Emails encontrados:");
    console.log("  - Revendedor:", buyerEmail || "NO ENCONTRADO");
    console.log("  - Fabricante:", factoryEmail || "NO ENCONTRADO");

    // ========================================
    // 2) GUARDAR PAGO
    // ========================================
    await paymentDocRef.set({
      paymentId,
      status: payment.status,
      createdAt: new Date(),
      metadata,
      processed: true,
    });
    console.log("✅ Pago guardado en Firestore");

    // ========================================
    // 3) CREAR ORDEN
    // ========================================
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
      status: "pending",
      createdAt: new Date(),
    };

    await orderRef.set(orderData);
    console.log("✅ Orden creada:", orderRef.id);

    // ========================================
    // 4) ENVIAR EMAIL AL REVENDEDOR
    // ========================================
    if (buyerEmail) {
      try {
        console.log("📧 Enviando email al revendedor...");
        
        const isDirect = orderType === "directa";
        const isPickup = shippingMode === "pickup";
        
        const now = new Date();
        const pickupDeadline = new Date(now.getTime() + (48 * 60 * 60 * 1000));

        const retailerHtml = `
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
      <h1>✅ Compra Confirmada</h1>
    </div>
    
    <p>¡Hola ${buyerName}!</p>
    <p>Tu pago fue aprobado exitosamente.</p>
    
    <div class="section">
      <h3 style="margin-top: 0;">📦 Detalles de tu Pedido</h3>
      <div class="info-row"><span class="label">Producto:</span> <span class="value">${productName}</span></div>
      <div class="info-row"><span class="label">Cantidad:</span> <span class="value">${originalQty} unidades</span></div>
      <div class="info-row"><span class="label">Tipo:</span> <span class="value">${isDirect ? 'Compra directa' : 'Compra fraccionada'}</span></div>
      <div class="info-row"><span class="label">Total pagado:</span> <span class="value">$ ${payment.transaction_amount}</span></div>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">🏭 Fabricante</h3>
      <div class="info-row"><span class="label">Nombre:</span> <span class="value">${factoryName}</span></div>
      <div class="info-row"><span class="label">Dirección:</span> <span class="value">${factoryAddress}</span></div>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Envío</h3>
      <p><strong>Modalidad:</strong> ${isPickup ? '🏭 Retiro en fábrica' : '📦 Envío a domicilio'}</p>
      ${isPickup ? `
        <div class="warning">
          <strong>⏰ IMPORTANTE:</strong> Tenés 48hs hábiles para retirar tu pedido desde que realizaste la compra.
          <br><br>
          <strong>Fecha límite:</strong> ${pickupDeadline.toLocaleDateString('es-AR')} a las ${pickupDeadline.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      ` : `
        <p>El fabricante coordinará el envío a tu dirección: <strong>${buyerAddress}</strong></p>
      `}
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        ID de pedido: ${orderRef.id}
      </p>
    </div>
  </div>
</body>
</html>
        `;

        const emailResult = await sendEmail({
          to: buyerEmail,
          subject: `✅ Compra Confirmada - ${productName}`,
          html: retailerHtml,
        });

        if (emailResult.success) {
          console.log("✅ Email enviado al revendedor:", buyerEmail);
        } else {
          console.error("❌ Error enviando email al revendedor:", emailResult.error);
        }
      } catch (emailError) {
        console.error("❌ Error enviando email al revendedor:", emailError);
      }
    } else {
      console.warn("⚠️ No se encontró email del revendedor");
    }

    // ========================================
    // 5) PROCESAR SEGÚN TIPO DE ORDEN
    // ========================================
    
    if (orderType === "fraccionado" && lotId) {
      console.log("📦 Procesando pedido FRACCIONADO...");

      const lotRef = db.collection("lots").doc(lotId);
      const lotDoc = await lotRef.get();

      if (!lotDoc.exists) {
        throw new Error(`Lote ${lotId} no encontrado`);
      }

      const lotData = lotDoc.data()!;
      const currentQty = lotData.currentQty || 0;
      const targetQty = lotData.targetQty || 0;
      const newCurrentQty = currentQty + originalQty;

      await lotRef.update({
        currentQty: newCurrentQty,
        lastOrderAt: new Date(),
      });

      console.log(`📊 Lote actualizado: ${currentQty} → ${newCurrentQty} / ${targetQty}`);

      // ========================================
      // 6) SI EL LOTE SE COMPLETÓ
      // ========================================
      if (newCurrentQty >= targetQty) {
        console.log("🎉 ¡LOTE COMPLETADO!");

        await lotRef.update({
          status: "closed",
          closedAt: new Date(),
        });

        const ordersSnap = await db
          .collection("orders")
          .where("lotId", "==", lotId)
          .get();

        const retailers: Array<{
          name: string;
          qty: number;
          address: string;
          phone?: string;
        }> = [];

        for (const orderDoc of ordersSnap.docs) {
          const orderData = orderDoc.data();
          const retailerId = orderData.buyerId;
          
          const retailerDoc = await db.collection("retailers").doc(retailerId).get();
          const userDoc = await db.collection("users").doc(retailerId).get();
          
          let name = "Revendedor";
          let address = "No disponible";
          let phone = undefined;
          
          if (userDoc.exists) {
            name = userDoc.data()?.name || userDoc.data()?.email || "Revendedor";
          }
          
          if (retailerDoc.exists) {
            const retailerData = retailerDoc.data();
            address = retailerData?.address?.formatted || "No disponible";
            phone = retailerData?.phone;
          }
          
          retailers.push({
            name,
            qty: orderData.qty || 0,
            address,
            phone,
          });
        }

        // ENVIAR EMAIL AL FABRICANTE (LOTE CERRADO)
        if (factoryEmail) {
          try {
            console.log("📧 Enviando email al fabricante (lote cerrado)...");
            
            const isPickup = lotType?.includes("retiro");
            
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
      ${retailers.map(r => `
        <div class="retailer">
          <div style="font-weight: bold; margin-bottom: 8px;">${r.name}</div>
          <div>• Cantidad: ${r.qty} unidades</div>
          <div>• Dirección: ${r.address}</div>
          ${r.phone ? `<div>• Teléfono: ${r.phone}</div>` : ''}
        </div>
      `).join('')}
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Logística</h3>
      ${isPickup ? `
        <p><strong>Modalidad:</strong> RETIRO EN FÁBRICA</p>
        <div class="warning">
          <strong>⏰ IMPORTANTE:</strong> Los revendedores tienen 48hs hábiles para retirar desde que realizaron la compra.
          <br><br>
          Asegurate de tener la mercadería preparada en tus horarios de atención.
        </div>
      ` : `
        <p><strong>Modalidad:</strong> ENVÍO POR PLATAFORMA</p>
        <ol style="margin: 15px 0; padding-left: 20px;">
          <li>Preparar ${newCurrentQty} unidades separadas por revendedor</li>
          <li>Punto de entrega: ${factoryAddress}</li>
          <li>Te contactaremos para coordinar el retiro</li>
        </ol>
      `}
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Preparar ${newCurrentQty} unidades totales</li>
        <li>Separar por revendedor (ver distribución arriba)</li>
        <li>${isPickup ? 'Tener lista para retiro en horarios de atención' : 'Esperar coordinación de logística'}</li>
      </ol>
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        ID de lote: ${lotId}
      </p>
    </div>
  </div>
</body>
</html>
            `;

            const emailResult = await sendEmail({
              to: factoryEmail,
              subject: `✅ Lote Completado - ${productName} (${newCurrentQty} unidades)`,
              html: lotClosedHtml,
            });

            if (emailResult.success) {
              console.log("✅ Email de lote cerrado enviado al fabricante:", factoryEmail);
            } else {
              console.error("❌ Error enviando email de lote cerrado:", emailResult.error);
            }
          } catch (emailError) {
            console.error("❌ Error enviando email de lote cerrado:", emailError);
          }
        }
      }

    } else if (orderType === "directa") {
      console.log("🚀 Procesando pedido DIRECTO...");

      // ENVIAR EMAIL AL FABRICANTE (PEDIDO DIRECTO)
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
      ${buyerPhone ? `<div class="info-row"><span class="label">Teléfono:</span> <span class="value">${buyerPhone}</span></div>` : ''}
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">🚚 Envío</h3>
      <p><strong>Modalidad:</strong> ${isPickup ? '🏭 Retiro en fábrica' : '📦 Envío por fábrica'}</p>
      ${isPickup ? `
        <div class="warning">
          <strong>⏰ IMPORTANTE:</strong> El cliente tiene 48hs hábiles para retirar desde que realizó la compra.
          <br><br>
          Asegurate de tener la mercadería lista en tus horarios de atención.
        </div>
      ` : `
        <p>Deberás coordinar el envío con el cliente a la dirección: <strong>${buyerAddress}</strong></p>
      `}
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Preparar ${originalQty} unidades de ${productName}</li>
        <li>${isPickup ? 'Tener la mercadería lista para retiro' : 'Coordinar envío con el cliente'}</li>
        <li>El pago ya está acreditado en tu cuenta</li>
      </ol>
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        ID de pedido: ${orderRef.id}
      </p>
    </div>
  </div>
</body>
</html>
          `;

          const emailResult = await sendEmail({
            to: factoryEmail,
            subject: `🎉 Nuevo Pedido - ${productName} (${originalQty} unidades)`,
            html: directOrderHtml,
          });

          if (emailResult.success) {
            console.log("✅ Email enviado al fabricante:", factoryEmail);
          } else {
            console.error("❌ Error enviando email al fabricante:", emailResult.error);
          }
        } catch (emailError) {
          console.error("❌ Error enviando email al fabricante:", emailError);
        }
      }
    }

    console.log("✅ Webhook procesado exitosamente");
    return NextResponse.json({ ok: true, orderId: orderRef.id });

  } catch (error: any) {
    console.error("❌ Error en webhook:", error);
    console.error("Stack trace:", error.stack);
    
    return NextResponse.json(
      { 
        error: error?.message || "Error procesando webhook",
        details: error?.stack 
      },
      { status: 500 }
    );
  }
}