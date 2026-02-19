// lib/mercadopago-split.ts
// 🔧 VERSIÓN SIN auto_return (COMPATIBLE CON SDK v2.11.0)

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
    factoryId?: string;  // ✅ AGREGADO: factoryId a la metadata
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
    commission?: number;
  };
  back_urls: {
    success: string;
    pending: string;
    failure: string;
  };
  factoryMPUserId?: string;
  shippingCost: number;
  productTotal: number;
  commission: number;
};

export async function createSplitPreference(params: SplitPaymentParams) {
  const {
    title,
    unit_price,
    quantity,
    metadata,
    back_urls,
    commission,
  } = params;

  // ✅ VALIDACIÓN: Verificar que back_urls esté completo
  console.log('🔍 Verificando back_urls:', back_urls);
  
  if (!back_urls?.success || !back_urls?.pending || !back_urls?.failure) {
    console.error('❌ back_urls incompleto:', back_urls);
    throw new Error('back_urls debe tener success, pending y failure');
  }

  console.log('✅ back_urls válido:', {
    success: back_urls.success,
    pending: back_urls.pending,
    failure: back_urls.failure,
  });

  const preference = new Preference(client);

  // 🔔 NOTIFICATION URL (webhook)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : 'https://mayoristamovil.com');
  
  const notificationUrl = `${baseUrl}/api/webhooks/mercadopago`;
  console.log('🔔 Notification URL:', notificationUrl);

  // ✅ PREPARAR BODY - VERSIÓN MINIMALISTA QUE FUNCIONA
  const baseBody: any = {
    items: [
      {
        id: metadata.productId,
        title,
        unit_price,
        quantity,
      },
    ],
    notification_url: notificationUrl,
    metadata: metadata,
  };

  console.log('📦 Creando preferencia con body:', {
    tipo: metadata.tipo,
    title,
    unit_price,
    notification_url: baseBody.notification_url,
  });

  try {
    // PEDIDO DIRECTO
    if (metadata.tipo === "directa") {
      console.log('🔵 Creando preferencia DIRECTA');
      
      const response = await preference.create({
        body: baseBody,
      });

      console.log('✅ Preferencia DIRECTA creada:', response.id);
      console.log('🔗 Init point:', response.init_point);
      return response;
    }

    // PEDIDO FRACCIONADO
    if (metadata.tipo === "fraccionada") {
      console.log('🔵 Creando preferencia FRACCIONADA con commission:', commission);
      
      const response = await preference.create({
        body: {
          ...baseBody,
          // marketplace_fee: commission, // ⚠️ Comentado si causa problemas
        },
      });

      console.log('✅ Preferencia FRACCIONADA creada:', response.id);
      console.log('🔗 Init point:', response.init_point);
      return response;
    }

    // FALLBACK
    console.log('🔵 Creando preferencia FALLBACK');
    
    const response = await preference.create({
      body: baseBody,
    });

    console.log('✅ Preferencia FALLBACK creada:', response.id);
    console.log('🔗 Init point:', response.init_point);
    return response;

  } catch (error: any) {
    console.error('❌ Error creando preferencia:', {
      message: error.message,
      error: error.error,
      status: error.status,
      cause: error.cause,
      body: error.body,
    });
    throw error;
  }
}