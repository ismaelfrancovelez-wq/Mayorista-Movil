import { NextResponse } from "next/server";
import { createPreference } from "../../../../lib/mercadopago";
import { createPurchaseOrder } from "../../../../lib/orders";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      productId,
      qty,
      tipo,
      withShipping,
      title,
      unitPrice,
    } = body;

    // 🔒 Validaciones mínimas
    if (!productId || !qty || !tipo || !title || !unitPrice) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    // 1️⃣ Crear preferencia en Mercado Pago
    const preference = await createPreference({
      title,
      unit_price: unitPrice,
      quantity: qty,
      metadata: {
        productId,
        qty,
        tipo,
        withShipping: Boolean(withShipping),
      },
      back_urls: {
        success:
          process.env.NEXT_PUBLIC_BASE_URL + "/success",
        pending:
          process.env.NEXT_PUBLIC_BASE_URL + "/pending",
        failure:
          process.env.NEXT_PUBLIC_BASE_URL + "/failure",
      },
    });

    // 2️⃣ VALIDAR preference.id (CLAVE)
    if (!preference.id) {
      throw new Error(
        "No se pudo obtener preferenceId de Mercado Pago"
      );
    }

    // 3️⃣ Crear ORDEN DE COMPRA (usuario)
    await createPurchaseOrder({
      productId,
      qty,
      tipo,
      withShipping: Boolean(withShipping),
      preferenceId: preference.id,
    });

    // 4️⃣ Devolver init_point al frontend
    return NextResponse.json({
      init_point: preference.init_point,
    });
  } catch (error) {
    console.error("Error create-preference:", error);

    return NextResponse.json(
      { error: "Error al crear preferencia" },
      { status: 500 }
    );
  }
}