import MercadoPagoConfig, { Preference } from "mercadopago";
import { env } from "./env";

/**
 * Configuración del cliente de Mercado Pago
 * Usa el SDK nuevo oficial
 */
const client = new MercadoPagoConfig({
  accessToken: env.mercadopago.accessToken(),
});

/**
 * Helper para crear una preferencia de pago
 * NO es una API Route
 * Se usa solo desde server (app/api)
 */
export async function createPreference({
  title,
  unit_price,
  quantity,
  metadata,
  back_urls,
}: {
  title: string;
  unit_price: number;
  quantity: number;
  metadata: {
    productId: string;
    qty: number;
    tipo: "directa" | "fraccionada" | "destacado";
    withShipping: boolean;
    featuredType?: "product" | "factory";
    featuredItemId?: string;
    featuredDuration?: number;
  };
  back_urls: {
    success: string;
    pending: string;
    failure: string;
  };
}) {
  const preference = new Preference(client);

  // ✅ FIX: notification_url para que MP llame al webhook cuando se aprueba el pago
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mayoristamovil.vercel.app";
  const notificationUrl = `${baseUrl}/api/webhooks/mercadopago`;

  const response = await preference.create({
    body: {
      items: [
        {
          id: metadata.productId,
          title,
          unit_price,
          quantity,
        },
      ],
      metadata,
      back_urls,
      auto_return: "approved",
      notification_url: notificationUrl, // ✅ AGREGADO
    },
  });

  return response;
}