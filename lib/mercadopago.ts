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
    tipo: "directa" | "fraccionada" | "destacado"; // ✅ AGREGADO "destacado"
    withShipping: boolean;
    // ✅ NUEVO: Campos opcionales para destacadoss
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
    },
  });

  return response;
}