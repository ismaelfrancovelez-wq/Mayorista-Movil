// lib/mercadopago-split.ts
//
// ✅ REFACTOR (Fase 1):
// - Eliminado el parámetro `commission` (era deprecated, no se usaba).
// - Eliminado `factoryMPUserId` (deprecated, no se usaba).
// - Eliminados `shippingCost` y `productTotal` de la firma (no se usaban acá).
// - Eliminada la propiedad `commission` del tipo de metadata.
//
// ⚠️ FASE 2 PENDIENTE: cuando se implemente OAuth de fabricantes, este archivo
// debe modificarse para:
// 1. Usar el access_token del FABRICANTE (no el global de la plataforma)
// 2. Agregar `marketplace_fee: shippingCost` al body de la preference
// Así el envío cae automáticamente en la cuenta de la plataforma y el resto
// (precio del producto) en la cuenta del fabricante.

import MercadoPagoConfig, { Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

type SplitPaymentParams = {
  title: string;
  unit_price: number;
  quantity: number;
  metadata: {
    productId: string;
    factoryId?: string;
    qty: number;
    tipo: "directa" | "fraccionada";
    withShipping: boolean;
    orderType?: string;
    lotType?: string;
    retailerId?: string;
    original_qty?: number;
    MF?: number;
    shippingCost?: number;
    shippingMode?: string;
    /** Método de pago elegido por el cliente (qr_money_in_mp, checkout_credit, etc) */
    paymentMethod?: string;
    reservationId?: string;
    lotId?: string;
  };
  back_urls: {
    success: string;
    pending: string;
    failure: string;
  };
  /** Tipos de pago a EXCLUIR (ej: si elegís solo débito, excluís credit_card) */
  excluded_payment_types?: { id: string }[];
};

export async function createSplitPreference(params: SplitPaymentParams) {
  const {
    title,
    unit_price,
    quantity,
    metadata,
    back_urls,
    excluded_payment_types,
  } = params;

  if (!back_urls?.success || !back_urls?.pending || !back_urls?.failure) {
    console.error("❌ back_urls incompleto:", back_urls);
    throw new Error("back_urls debe tener success, pending y failure");
  }

  const preference = new Preference(client);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://mayoristamovil.com");

  const notificationUrl = `${baseUrl}/api/webhooks/mercadopago`;

  const body: any = {
    items: [
      {
        id: metadata.productId,
        title,
        unit_price,
        quantity,
      },
    ],
    notification_url: notificationUrl,
    metadata,
    back_urls,
  };

  // Si el caller pidió excluir tipos de pago (ej: solo débito), aplicarlo
  if (excluded_payment_types && excluded_payment_types.length > 0) {
    body.payment_methods = {
      excluded_payment_types,
      installments: 1, // sin cuotas
    };
  }

  console.log("📦 Creando preferencia:", {
    tipo: metadata.tipo,
    paymentMethod: metadata.paymentMethod || "any",
    title,
    unit_price,
    excluded: excluded_payment_types?.map((e) => e.id) || [],
  });

  try {
    const response = await preference.create({ body });
    console.log("✅ Preferencia creada:", response.id);
    return response;
  } catch (error: any) {
    console.error("❌ Error creando preferencia:", {
      message: error.message,
      status: error.status,
      cause: error.cause,
    });
    throw error;
  }
}