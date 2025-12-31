import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    /**
     * 🔒 VALIDACIONES CLAVE
     */
    if (
      typeof body.unitPrice !== "number" ||
      typeof body.qty !== "number" ||
      body.qty <= 0 ||
      !body.productId
    ) {
      return NextResponse.json(
        { error: "Datos de pago inválidos" },
        { status: 400 }
      );
    }

    /**
     * 🔑 CONFIGURACIÓN MP
     */
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const preference = new Preference(client);

    /**
     * 🧾 CREAR PREFERENCIA
     */
    const result = await preference.create({
      body: {
        items: [
          {
            id: body.productId,          // ID del producto
            title: body.title ?? "Producto",
            quantity: body.qty,          // Cantidad total
            unit_price: body.unitPrice,  // Precio unitario
            currency_id: "ARS",
          },
        ],

        /**
         * 📦 METADATA → SE USA EN WEBHOOK
         */
        metadata: {
          orderType: body.orderType,     // "directa" | "fraccionada"
          productId: body.productId,
          qty: body.qty,
          MF: body.MF ?? null,
          shippingCost: body.shippingCost ?? 0,
        },

        /**
         * 🔁 REDIRECCIONES
         */
        back_urls: {
          success: "http://localhost:3000/success",
          failure: "http://localhost:3000/failure",
          pending: "http://localhost:3000/pending",
        },

        auto_return: "approved",

        /**
         * 🔔 WEBHOOK
         */
        notification_url:
          "http://localhost:3000/api/webhooks/MercadoPago",
      },
    });

    /**
     * ✅ RESPUESTA AL FRONT
     */
    return NextResponse.json({
      init_point: result.init_point,
      preferenceId: result.id,
    });
  } catch (error) {
    console.error("ERROR MERCADOPAGO:", error);

    return NextResponse.json(
      { error: "Error creando preferencia de pago" },
      { status: 500 }
    );
  }
}