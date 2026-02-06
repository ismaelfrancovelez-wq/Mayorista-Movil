// app/api/test/webhook-simulation/route.ts
// 🧪 Simulador de webhook de MercadoPago para testing de emails

import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email/client";

export async function POST(req: Request) {
  try {
    const { 
      buyerEmail, 
      buyerName = "Cliente Test",
      factoryEmail, 
      factoryName = "Fabricante Test",
      productName = "Producto de Prueba",
      quantity = 10,
      price = 1000
    } = await req.json();

    console.log("🧪 ============================================");
    console.log("🧪 SIMULANDO WEBHOOK DE MERCADOPAGO");
    console.log("🧪 ============================================");
    console.log("Datos recibidos:", {
      buyerEmail,
      buyerName,
      factoryEmail,
      factoryName,
      productName,
      quantity,
      price
    });

    const results = {
      buyer: null as any,
      factory: null as any,
    };

    // ===================================================
    // 1️⃣ EMAIL AL COMPRADOR
    // ===================================================
    if (buyerEmail) {
      console.log("\n📧 Enviando email al comprador:", buyerEmail);
      
      const buyerHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: Arial, sans-serif; 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px;
      background: #f5f5f5;
    }
    .container { 
      background: white; 
      border-radius: 8px; 
      padding: 30px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      text-align: center; 
      border-bottom: 3px solid #10b981; 
      padding-bottom: 20px; 
      margin-bottom: 30px;
    }
    .header h1 { 
      color: #10b981; 
      margin: 0; 
      font-size: 24px;
    }
    .section { 
      margin: 25px 0; 
      padding: 20px; 
      background: #f9fafb; 
      border-radius: 6px; 
      border-left: 4px solid #10b981;
    }
    .info-row { 
      margin: 10px 0; 
    }
    .label { 
      font-weight: 600; 
      color: #6b7280; 
    }
    .value { 
      font-weight: 600; 
      color: #111827; 
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      color: #6b7280; 
      font-size: 14px;
    }
    .test-badge {
      background: #fbbf24;
      color: #78350f;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      display: inline-block;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center;">
      <span class="test-badge">🧪 EMAIL DE PRUEBA</span>
    </div>
    
    <div class="header">
      <h1>✅ Compra Confirmada</h1>
    </div>
    
    <p>¡Hola <strong>${buyerName}</strong>!</p>
    <p>Tu compra ha sido confirmada exitosamente.</p>
    
    <div class="section">
      <h3 style="margin-top: 0;">📦 Detalles del Pedido</h3>
      <div class="info-row">
        <span class="label">Producto:</span> 
        <span class="value">${productName}</span>
      </div>
      <div class="info-row">
        <span class="label">Cantidad:</span> 
        <span class="value">${quantity} unidades</span>
      </div>
      <div class="info-row">
        <span class="label">Monto:</span> 
        <span class="value">$ ${price.toLocaleString('es-AR')}</span>
      </div>
      <div class="info-row">
        <span class="label">Fecha:</span> 
        <span class="value">${new Date().toLocaleString('es-AR')}</span>
      </div>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>El fabricante está preparando tu pedido</li>
        <li>Te contactaremos para coordinar la entrega</li>
        <li>Recibirás una notificación cuando esté listo</li>
      </ol>
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        Este es un email de prueba generado en localhost
      </p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        const buyerResult = await sendEmail({
          to: buyerEmail,
          subject: "✅ Compra Confirmada - Mayorista Móvil (TEST)",
          html: buyerHtml,
        });

        console.log("✅ Email al comprador enviado:", buyerResult);
        results.buyer = {
          success: buyerResult.success,
          to: buyerEmail,
          messageId: buyerResult.messageId,
        };
      } catch (error: any) {
        console.error("❌ Error enviando email al comprador:", error);
        results.buyer = {
          success: false,
          error: error.message,
        };
      }
    }

    // ===================================================
    // 2️⃣ EMAIL AL FABRICANTE
    // ===================================================
    if (factoryEmail) {
      console.log("\n📧 Enviando email al fabricante:", factoryEmail);
      
      const factoryHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: Arial, sans-serif; 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 20px;
      background: #f5f5f5;
    }
    .container { 
      background: white; 
      border-radius: 8px; 
      padding: 30px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { 
      text-align: center; 
      border-bottom: 3px solid #2563eb; 
      padding-bottom: 20px; 
      margin-bottom: 30px;
    }
    .header h1 { 
      color: #2563eb; 
      margin: 0; 
      font-size: 24px;
    }
    .section { 
      margin: 25px 0; 
      padding: 20px; 
      background: #f9fafb; 
      border-radius: 6px; 
      border-left: 4px solid #2563eb;
    }
    .info-row { 
      margin: 10px 0; 
    }
    .label { 
      font-weight: 600; 
      color: #6b7280; 
    }
    .value { 
      font-weight: 600; 
      color: #111827; 
    }
    .footer { 
      text-align: center; 
      margin-top: 30px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      color: #6b7280; 
      font-size: 14px;
    }
    .test-badge {
      background: #fbbf24;
      color: #78350f;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      display: inline-block;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center;">
      <span class="test-badge">🧪 EMAIL DE PRUEBA</span>
    </div>
    
    <div class="header">
      <h1>🎉 Nuevo Pedido</h1>
    </div>
    
    <p>¡Felicitaciones <strong>${factoryName}</strong>!</p>
    <p>Recibiste un nuevo pedido confirmado.</p>
    
    <div class="section">
      <h3 style="margin-top: 0;">📦 Detalles del Pedido</h3>
      <div class="info-row">
        <span class="label">Producto:</span> 
        <span class="value">${productName}</span>
      </div>
      <div class="info-row">
        <span class="label">Cantidad:</span> 
        <span class="value">${quantity} unidades</span>
      </div>
      <div class="info-row">
        <span class="label">Monto:</span> 
        <span class="value">$ ${price.toLocaleString('es-AR')}</span>
      </div>
      <div class="info-row">
        <span class="label">Fecha:</span> 
        <span class="value">${new Date().toLocaleString('es-AR')}</span>
      </div>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">👤 Cliente</h3>
      <div class="info-row">
        <span class="label">Nombre:</span> 
        <span class="value">${buyerName}</span>
      </div>
      <div class="info-row">
        <span class="label">Email:</span> 
        <span class="value">${buyerEmail}</span>
      </div>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">⏰ Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Preparar ${quantity} unidades de ${productName}</li>
        <li>Coordinar envío o retiro con el cliente</li>
        <li>El pago ya está acreditado en tu cuenta</li>
      </ol>
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Tu plataforma mayorista de confianza</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        Este es un email de prueba generado en localhost
      </p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        const factoryResult = await sendEmail({
          to: factoryEmail,
          subject: "🎉 Nuevo Pedido - Mayorista Móvil (TEST)",
          html: factoryHtml,
        });

        console.log("✅ Email al fabricante enviado:", factoryResult);
        results.factory = {
          success: factoryResult.success,
          to: factoryEmail,
          messageId: factoryResult.messageId,
        };
      } catch (error: any) {
        console.error("❌ Error enviando email al fabricante:", error);
        results.factory = {
          success: false,
          error: error.message,
        };
      }
    }

    console.log("\n🧪 ============================================");
    console.log("🧪 SIMULACIÓN COMPLETADA");
    console.log("🧪 ============================================\n");

    return NextResponse.json({
      success: true,
      message: "Simulación de emails completada",
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("❌ Error en simulación:", error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

// También soporta GET para testing rápido desde el navegador
export async function GET() {
  return NextResponse.json({
    message: "Endpoint de simulación de webhook",
    usage: {
      method: "POST",
      url: "/api/test/webhook-simulation",
      body: {
        buyerEmail: "comprador@example.com",
        buyerName: "Juan Pérez (opcional)",
        factoryEmail: "fabricante@example.com",
        factoryName: "Mi Fábrica (opcional)",
        productName: "Producto Test (opcional)",
        quantity: 10,
        price: 1000,
      },
    },
    example: `
curl -X POST http://localhost:3000/api/test/webhook-simulation \\
  -H "Content-Type: application/json" \\
  -d '{
    "buyerEmail": "tu-email@gmail.com",
    "factoryEmail": "mayoristamovilargentina@gmail.com",
    "productName": "Zapatillas Nike",
    "quantity": 50,
    "price": 50000
  }'
    `.trim(),
  });
}