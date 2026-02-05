// lib/email/client.ts - VERSIÓN GMAIL SMTP COMPLETA

import nodemailer from 'nodemailer';

/**
 * Cliente de Email usando Gmail SMTP
 * 
 * Configuración requerida en .env:
 * - GMAIL_USER: tu-email@gmail.com
 * - GMAIL_APP_PASSWORD: contraseña de app de 16 caracteres
 */

// Configurar transporter de Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Verificar configuración al iniciar (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Error en configuración de Gmail SMTP:', error);
    } else {
      console.log('✅ Gmail SMTP configurado correctamente');
    }
  });
}

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer | string;
    path?: string;
  }>;
};

/**
 * Envía un email usando Gmail SMTP
 * 
 * @param to - Email(s) destinatario(s)
 * @param subject - Asunto del email
 * @param html - Contenido HTML del email
 * @param from - Email remitente (opcional, usa GMAIL_USER por defecto)
 * @param attachments - Archivos adjuntos (opcional)
 * @returns Resultado del envío
 */
export async function sendEmail({ 
  to, 
  subject, 
  html, 
  from,
  attachments 
}: SendEmailParams) {
  try {
    // Validar que tenemos las credenciales
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ Faltan credenciales de Gmail SMTP');
      console.error('Variables requeridas: GMAIL_USER, GMAIL_APP_PASSWORD');
      throw new Error('Gmail SMTP no configurado');
    }

    // Email desde el que se envía
    const fromEmail = from || process.env.GMAIL_USER;

    // Normalizar destinatarios
    const recipients = Array.isArray(to) ? to.join(', ') : to;

    // Configurar el email
    const mailOptions = {
      from: fromEmail,
      to: recipients,
      subject: subject,
      html: html,
      attachments: attachments || [],
    };

    console.log('📧 Enviando email...', {
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      hasAttachments: !!attachments && attachments.length > 0,
    });

    // Enviar email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email enviado exitosamente:', {
      messageId: info.messageId,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
    });

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    
    // Log detallado del error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // No lanzar error para que la aplicación siga funcionando
    // incluso si el email falla
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Envía múltiples emails en paralelo
 * 
 * @param emails - Array de emails a enviar
 * @returns Estadísticas del envío
 */
export async function sendBatchEmails(emails: SendEmailParams[]) {
  console.log(`📧 Enviando ${emails.length} emails en batch...`);

  const results = await Promise.allSettled(
    emails.map(email => sendEmail(email))
  );

  const successful = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length;
  
  const failed = results.length - successful;

  console.log(`✅ Batch completado: ${successful} exitosos, ${failed} fallidos`);

  return {
    total: emails.length,
    successful,
    failed,
    results,
  };
}

/**
 * Verifica que la configuración de Gmail SMTP sea válida
 * 
 * @returns true si la configuración es válida
 */
export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ Configuración de Gmail SMTP verificada');
    return true;
  } catch (error) {
    console.error('❌ Configuración de Gmail SMTP inválida:', error);
    return false;
  }
}