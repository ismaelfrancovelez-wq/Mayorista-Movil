import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    /* ===============================
       1️⃣ DESESTRUCTURAR BODY
       🔑 originalQty ES CLAVE
    =============================== */
    const {
      title,
      unitPrice,    // 🔥 TOTAL FINAL YA CALCULADO (producto + comisión + envío)
      qty,          // ⚠️ SIEMPRE 1 (regla MP)
      originalQty,  // 🔑 CANTIDAD REAL (25, 30, etc)
      orderType,
      lotType,
      productId,
      retailerId,
      shippingMode,
      shippingCost,
      MF,
    } = body;

    /* ===============================
       2️⃣ VALIDACIONES BÁSICAS
    =============================== */
    if (!originalQty || !Number.isFinite(Number(originalQty))) {
      console.error("❌ originalQty inválido:", originalQty);
      return NextResponse.json(
        { error: "originalQty inválido" },
        { status: 400 }
      );
    }

    /* ===============================
       3️⃣ CLIENTE MP
    =============================== */
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const preference = new Preference(client);

    /* ===============================
       4️⃣ CREAR PREFERENCIA
    =============================== */
    const result = await preference.create({
      body: {
        items: [
          {
            id: productId,
            title,
            quantity: 1,           // ⚠️ SIEMPRE 1
            unit_price: unitPrice, // 🔥 TOTAL REAL A COBRAR
          },
        ],

        /* ===============================
           🔑 METADATA (FUENTE DE VERDAD)
        =============================== */
        metadata: {
  orderType,
  lotType,
  productId,
  retailerId,

  // 🔑 IMPORTANTE: snake_case
  original_qty: originalQty,

  MF,
  shippingCost,
  shippingMode,
},

        notification_url: process.env.MERCADOPAGO_WEBHOOK_URL!,
      },
    });

    /* ===============================
       5️⃣ RESPUESTA
    =============================== */
    return NextResponse.json({
      init_point: result.init_point,
    });

  } catch (error) {
    console.error("❌ ERROR MP:", error);
    return NextResponse.json(
      { error: "Error iniciando pago" },
      { status: 500 }
    );
  }
}