// lib/email/client.ts

import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️ RESEND_API_KEY no configurada');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Parámetros base para enviar email
 */
export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Envía un email usando Resend
 */
export async function sendEmail(params: SendEmailParams) {
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Mayorista Móvil <onboarding@resend.dev>',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    console.log('✅ Email enviado:', result);
    return { success: true, id: result.data?.id };
    
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error };
  }
}