import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🔒 Validaciones básicas
    if (
      typeof body.unitPrice !== "number" ||
      typeof body.qty !== "number" ||
      body.qty <= 0
    ) {
      return NextResponse.json(
        { error: "Datos de pago inválidos" },
        { status: 400 }
      );
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const preference = new Preference(client);

    // ✅ FIX: usar variable de entorno en lugar de ngrok/localhost hardcodeado
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mayoristamovil.com";

    const result = await preference.create({
      body: {
        items: [
          {
            id: String(body.productId ?? "prod_test_123"),
            title: "Producto de prueba",
            quantity: body.qty,
            unit_price: body.unitPrice,
          },
        ],

        // ✅ FIX: webhook apunta a la URL correcta via env var
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,

        metadata: {
          orderType: "fraccionado",
          productId: body.productId ?? "prod_test_123",
          qty: body.qty,
          MF: body.MF ?? 50,
          retailerId: "retailer_test",
          factoryId: "factory_test",
        },

        back_urls: {
          success: `${baseUrl}/success`,
          failure: `${baseUrl}/failure`,
          pending: `${baseUrl}/pending`,
        },
      },
    });

    return NextResponse.json({
      init_point: result.init_point,
    });
  } catch (error) {
    console.error("ERROR MP:", error);
    return NextResponse.json(
      { error: "Error creando preferencia" },
      { status: 500 }
    );
  }
}