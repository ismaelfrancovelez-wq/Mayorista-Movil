// app/api/test/email/route.ts
// 🧪 Endpoint para probar Gmail SMTP

import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email/client";

export async function GET(req: Request) {
  console.log("🧪 Testing Gmail SMTP configuration...");
  
  // 1️⃣ Verificar que las variables de entorno estén configuradas
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.error("❌ Variables de entorno faltantes");
    return NextResponse.json({
      error: "Credenciales de Gmail no configuradas",
      details: {
        GMAIL_USER: gmailUser ? "✅ Configurado" : "❌ Falta",
        GMAIL_APP_PASSWORD: gmailPass ? "✅ Configurado" : "❌ Falta",
      },
      instructions: [
        "1. Crea o edita el archivo .env.local en la raíz del proyecto",
        "2. Agrega las siguientes líneas:",
        "   GMAIL_USER=tu-email@gmail.com",
        "   GMAIL_APP_PASSWORD=tu-contraseña-de-app-de-16-caracteres",
        "3. Reinicia el servidor (npm run dev)",
      ]
    }, { status: 500 });
  }

  console.log("✅ Variables de entorno encontradas");
  console.log("📧 GMAIL_USER:", gmailUser);
  console.log("🔑 GMAIL_APP_PASSWORD:", gmailPass.substring(0, 4) + "************");

  // 2️⃣ Enviar email de prueba
  try {
    console.log("📧 Enviando email de prueba...");
    
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
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
    }
    .section { 
      margin: 20px 0; 
      padding: 15px; 
      background: #f9fafb; 
      border-radius: 6px; 
      border-left: 4px solid #10b981;
    }
    .success { 
      background: #d1fae5; 
      border: 2px solid #10b981; 
      border-radius: 6px; 
      padding: 15px; 
      margin: 20px 0;
      text-align: center;
    }
    .info { 
      color: #6b7280; 
      font-size: 14px; 
      margin: 10px 0;
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
      <h1>✅ Gmail SMTP Test Exitoso</h1>
    </div>
    
    <div class="success">
      <h2 style="margin: 0; color: #059669;">¡Configuración Correcta!</h2>
      <p style="margin: 10px 0 0 0;">Tu Gmail SMTP está funcionando perfectamente</p>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">📋 Detalles de la Prueba</h3>
      <div class="info">
        <strong>Fecha y hora:</strong> ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
      </div>
      <div class="info">
        <strong>Servidor:</strong> localhost:3000
      </div>
      <div class="info">
        <strong>Email remitente:</strong> ${gmailUser}
      </div>
      <div class="info">
        <strong>Email destinatario:</strong> ${gmailUser}
      </div>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">🎯 Próximos Pasos</h3>
      <ol style="margin: 15px 0; padding-left: 20px;">
        <li>Los emails de compra se enviarán automáticamente</li>
        <li>Los emails al fabricante funcionarán correctamente</li>
        <li>Puedes probar haciendo una compra de prueba</li>
      </ol>
    </div>
    
    <div class="section">
      <h3 style="margin-top: 0;">⚠️ Importante</h3>
      <p>
        Para que los webhooks de MercadoPago funcionen en localhost, 
        necesitas usar <strong>ngrok</strong> o simular los webhooks manualmente.
      </p>
      <p style="margin-top: 10px; font-size: 12px; color: #6b7280;">
        Consulta la documentación para más detalles.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Mayorista Móvil</strong></p>
      <p>Sistema de emails configurado correctamente ✅</p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: gmailUser, // Envía a tu propio email
      subject: "✅ Test Gmail SMTP - Mayorista Móvil",
      html: testHtml,
    });

    console.log("✅ Email enviado exitosamente:", result);

    return NextResponse.json({
      success: true,
      message: "Email de prueba enviado exitosamente",
      details: {
        to: gmailUser,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
      },
      instructions: [
        "1. Revisa tu bandeja de entrada en Gmail",
        "2. Si no lo ves, revisa la carpeta de Spam",
        "3. Si lo recibiste, ¡tu configuración está perfecta!",
      ]
    });

  } catch (error: any) {
    console.error("❌ Error enviando email:", error);
    
    return NextResponse.json({
      error: "Error al enviar email de prueba",
      message: error.message,
      stack: error.stack,
      troubleshooting: [
        "1. Verifica que GMAIL_APP_PASSWORD sea una 'Contraseña de aplicación' de 16 caracteres",
        "2. NO uses tu contraseña normal de Gmail",
        "3. Genera una nueva en: https://myaccount.google.com/apppasswords",
        "4. Asegúrate de tener verificación en 2 pasos activada",
        "5. Copia la contraseña SIN espacios en .env.local",
      ]
    }, { status: 500 });
  }
}