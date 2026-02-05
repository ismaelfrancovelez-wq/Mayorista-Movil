// app/api/test/email/route.ts
// Endpoint de prueba para verificar que Gmail SMTP funciona

import { NextResponse } from "next/server";
import { sendEmail } from "../../../../lib/email/client";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const toEmail = searchParams.get('to') || process.env.GMAIL_USER;

    if (!toEmail) {
      return NextResponse.json({
        success: false,
        error: "No se especificó destinatario",
      }, { status: 400 });
    }

    console.log('🧪 Iniciando test de email...');

    const result = await sendEmail({
      to: toEmail,
      subject: "🧪 Test Email - Mayorista Móvil",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4F46E5;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .success-badge {
              display: inline-block;
              background-color: #10b981;
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-weight: bold;
              margin: 20px 0;
            }
            .info-box {
              background-color: white;
              border-left: 4px solid #4F46E5;
              padding: 15px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧪 Email de Prueba</h1>
            </div>
            <div class="content">
              <div class="success-badge">✅ Gmail SMTP Funcionando</div>
              
              <p>¡Felicitaciones! Si estás viendo este email, Gmail SMTP está configurado correctamente.</p>
              
              <div class="info-box">
                <strong>📊 Información:</strong><br>
                <strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}<br>
                <strong>Destinatario:</strong> ${toEmail}<br>
                <strong>Sistema:</strong> Mayorista Móvil
              </div>
              
              <p><strong>✅ Todo listo para:</strong></p>
              <ul>
                <li>Enviar confirmaciones de compra</li>
                <li>Notificar pagos recibidos</li>
                <li>Alertar sobre envíos</li>
              </ul>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "✅ Email de prueba enviado correctamente",
        details: {
          to: toEmail,
          messageId: result.messageId,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        message: "❌ Error al enviar email",
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("❌ Error en test de email:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 500 });
  }
}