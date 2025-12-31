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

        // 🔔 WEBHOOK (YA FUNCIONA)
        notification_url:
          "https://thatcher-nonideological-windingly.ngrok-free.dev/api/webhooks/mercadopago",

        // 🧠 METADATA (ESTO ERA LO QUE FALTABA)
        metadata: {
          orderType: "fraccionado",
          productId: body.productId ?? "prod_test_123",
          qty: body.qty,
          MF: body.MF ?? 50,
          retailerId: "retailer_test",
          factoryId: "factory_test",
        },

        // ⛔ auto_return NO usar
        back_urls: {
          success: "http://localhost:3000/success",
          failure: "http://localhost:3000/failure",
          pending: "http://localhost:3000/pending",
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