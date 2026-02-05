// app/api/test/gmail/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email/client";

/**
 * Endpoint de prueba para verificar configuración de Gmail SMTP
 * 
 * Uso: GET http://localhost:3000/api/test/gmail
 */
export async function GET() {
  try {
    console.log("🧪 Iniciando prueba de Gmail SMTP...");

    // 1. Verificar variables de entorno
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      return NextResponse.json({
        success: false,
        error: "Variables de entorno no configuradas",
        details: {
          GMAIL_USER: gmailUser ? "✅ Configurado" : "❌ Falta GMAIL_USER",
          GMAIL_APP_PASSWORD: gmailPassword ? "✅ Configurado" : "❌ Falta GMAIL_APP_PASSWORD",
        },
        instructions: [
          "1. Crea un archivo .env.local en la raíz del proyecto",
          "2. Agrega:",
          "   GMAIL_USER=tucorreo@gmail.com",
          "   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx",
          "3. Reinicia el servidor",
        ]
      }, { status: 500 });
    }

    console.log("✅ Variables de entorno encontradas");
    console.log("  - GMAIL_USER:", gmailUser);
    console.log("  - GMAIL_APP_PASSWORD: [OCULTO]");

    // 2. Intentar enviar email de prueba
    console.log("📧 Enviando email de prueba...");
    
    const result = await sendEmail({
      to: gmailUser, // Enviamos a nosotros mismos
      subject: "🧪 Prueba de Gmail SMTP - Mayorista Móvil",
      html: `
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
      background-color: #f5f5f5;
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
    .success-box {
      background: #d1fae5;
      border: 2px solid #10b981;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-box {
      background: #f9fafb;
      border-left: 4px solid #3b82f6;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Configuración Exitosa</h1>
    </div>
    
    <div class="success-box">
      <h2 style="margin-top: 0; color: #065f46;">¡Todo funciona correctamente!</h2>
      <p style="margin: 0;">
        Si estás leyendo este email, significa que tu configuración de Gmail SMTP 
        está funcionando perfectamente.
      </p>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">📋 Detalles de la Configuración</h3>
      <div class="info-row">
        <span class="label">Gmail User:</span> 
        <span class="value">${gmailUser}</span>
      </div>
      <div class="info-row">
        <span class="label">Gmail Password:</span> 
        <span class="value">Configurada ✅</span>
      </div>
      <div class="info-row">
        <span class="label">Fecha de prueba:</span> 
        <span class="value">${new Date().toLocaleString('es-AR')}</span>
      </div>
    </div>
    
    <div class="info-box">
      <h3 style="margin-top: 0;">🎯 Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Los emails se enviarán automáticamente cuando:
          <ul>
            <li>Un revendedor realice una compra</li>
            <li>Se complete un lote fraccionado</li>
            <li>Se confirme un pedido directo</li>
          </ul>
        </li>
        <li>Revisa la carpeta de spam por las dudas</li>
        <li>Todos los emails llegarán desde: <strong>${gmailUser}</strong></li>
      </ol>
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Sistema de notificaciones por email</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 10px;">
        Este es un email de prueba automático
      </p>
    </div>
  </div>
</body>
</html>
      `
    });

    if (result.success) {
      console.log("✅ Email enviado exitosamente");
      return NextResponse.json({
        success: true,
        message: "✅ Email de prueba enviado exitosamente",
        details: {
          sentTo: gmailUser,
          messageId: result.messageId,
          timestamp: new Date().toISOString(),
        },
        nextSteps: [
          "1. Revisa tu bandeja de entrada en: " + gmailUser,
          "2. Si no llega, revisa la carpeta de spam",
          "3. Los emails se enviarán automáticamente en compras reales",
        ]
      });
    } else {
      console.error("❌ Error enviando email:", result.error);
      return NextResponse.json({
        success: false,
        error: "Error enviando email",
        details: result.error,
        possibleCauses: [
          "La contraseña de aplicación de Gmail puede ser incorrecta",
          "Verificación en 2 pasos no activada en Google",
          "Contraseña de aplicación mal copiada (debe tener 16 caracteres sin espacios)",
        ],
        howToFix: [
          "1. Ve a: https://myaccount.google.com/security",
          "2. Activa 'Verificación en 2 pasos'",
          "3. Busca 'Contraseñas de aplicaciones'",
          "4. Genera una nueva contraseña para 'Correo'",
          "5. Copia la contraseña de 16 caracteres (sin espacios)",
          "6. Actualiza GMAIL_APP_PASSWORD en .env.local",
          "7. Reinicia el servidor",
        ]
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("❌ Error en prueba de Gmail:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message || "Error desconocido",
      stack: error.stack,
      troubleshooting: [
        "Verifica que las variables de entorno estén en .env.local",
        "Asegúrate de haber reiniciado el servidor después de agregar las variables",
        "Revisa los logs en la consola para más detalles",
      ]
    }, { status: 500 });
  }
}