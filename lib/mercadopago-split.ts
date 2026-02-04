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
  // 🆕 AGREGAR PAYER
  payer?: {
    email: string;
    name?: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
  };
};

export async function createSplitPreference(params: SplitPaymentParams) {
  const {
    title,
    unit_price,
    quantity,
    metadata,
    back_urls,
    commission,
    payer, // 🆕 DESTRUCTURE PAYER
  } = params;

  const preference = new Preference(client);

  // 🆕 PAYER DEFAULT SI NO SE PROVEE
  const defaultPayer = payer || {
    email: "comprador@example.com", // Email genérico
  };

  if (metadata.tipo === "directa") {
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
        back_urls,
        auto_return: "approved",
        metadata: metadata as any,
        payer: defaultPayer, // 🆕 AGREGAR PAYER
      },
    });

    return response;
  }

  if (metadata.tipo === "fraccionada") {
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
        back_urls,
        auto_return: "approved",
        metadata: metadata as any,
        marketplace_fee: commission,
        payer: defaultPayer, // 🆕 AGREGAR PAYER
      },
    });

    return response;
  }

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
      back_urls,
      auto_return: "approved",
      metadata: metadata as any,
      payer: defaultPayer, // 🆕 AGREGAR PAYER
    },
  });

  return response;
}