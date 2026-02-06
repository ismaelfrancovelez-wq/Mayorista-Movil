// lib/email/client.ts - VERSIÓN RESEND COMPLETA (mantiene todas las funciones originales)

import { Resend } from 'resend';

/**
 * Cliente de Email usando Resend
 * 
 * Configuración requerida en .env:
 * - RESEND_API_KEY: tu API key de Resend
 * - EMAIL_FROM: email desde el que se envían los correos (debe estar verificado en Resend)
 */

// Inicializar cliente de Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Verificar configuración al iniciar (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY no está configurada');
  } else if (!process.env.EMAIL_FROM) {
    console.error('⚠️ EMAIL_FROM no está configurada, se usará el default de Resend');
  } else {
    console.log('✅ Resend configurado correctamente');
  }
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
 * Envía un email usando Resend
 * 
 * @param to - Email(s) destinatario(s)
 * @param subject - Asunto del email
 * @param html - Contenido HTML del email
 * @param from - Email remitente (opcional, usa EMAIL_FROM por defecto)
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
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Falta RESEND_API_KEY');
      console.error('Variables requeridas: RESEND_API_KEY, EMAIL_FROM');
      throw new Error('Resend no configurado');
    }

    // Email desde el que se envía
    const fromEmail = from || process.env.EMAIL_FROM || 'onboarding@resend.dev';

    // Normalizar destinatarios
    const recipients = Array.isArray(to) ? to : [to];

    console.log('📧 Enviando email...', {
      to: recipients,
      subject: subject,
      hasAttachments: !!attachments && attachments.length > 0,
    });

    // Preparar attachments para Resend (si existen)
    const resendAttachments = attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      path: att.path,
    }));

    // Enviar email con Resend
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: subject,
      html: html,
      attachments: resendAttachments,
    });

    if (error) {
      console.error('❌ Error de Resend:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido',
      };
    }

    console.log('✅ Email enviado exitosamente:', {
      messageId: data?.id,
      to: recipients,
      subject: subject,
    });

    return {
      success: true,
      messageId: data?.id,
      accepted: recipients,
      rejected: [],
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
 * Verifica que la configuración de Resend sea válida
 * 
 * @returns true si la configuración es válida
 */
export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY no configurada');
      return false;
    }
    
    // Resend no tiene método verify() como nodemailer
    // pero podemos verificar que la API key tenga el formato correcto
    if (!process.env.RESEND_API_KEY.startsWith('re_')) {
      console.error('❌ RESEND_API_KEY tiene formato inválido (debe empezar con "re_")');
      return false;
    }
    
    console.log('✅ Configuración de Resend verificada');
    return true;
  } catch (error) {
    console.error('❌ Configuración de Resend inválida:', error);
    return false;
  }
}