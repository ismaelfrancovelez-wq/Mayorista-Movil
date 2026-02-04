import { NextResponse } from "next/server";
import { createPreference } from "../../../../../lib/mercadopago";
import { cookies } from "next/headers";
import rateLimit from "../../../../../lib/rate-limit"; // ✅ NUEVO

// ✅ NUEVO: Crear el limitador
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minuto
  uniqueTokenPerInterval: 500,
});

export async function POST(req: Request) {
  // ✅ NUEVO: Verificar rate limit
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  
  try {
    await limiter.check(10, ip); // Máximo 10 compras fraccionadas por minuto
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Por favor, espera un minuto." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const { productId, qty, mode } = body;

    if (!productId || !qty || qty <= 0) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    // 🔍 Retailer desde cookie
    const retailerId = cookies().get("userId")?.value;

    if (!retailerId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const withShipping = mode === "envio";

    /* ===============================
       MERCADO PAGO PREFERENCE
    =============================== */
    const preference = await createPreference({
      title: "Compra fraccionada",
      unit_price: 1, // 💡 el monto real se calcula luego
      quantity: 1,
      metadata: {
        productId,
        qty,
        tipo: "fraccionada", // ✅ CLAVE (YA EXISTE EN EL TIPO)
        withShipping,
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

    if (!preference.init_point) {
      throw new Error("No se pudo crear preferencia");
    }

    return NextResponse.json({
      init_point: preference.init_point,
    });
  } catch (error) {
    console.error("❌ FRACCIONADO CREATE ERROR:", error);

    return NextResponse.json(
      { error: "Error creando compra fraccionada" },
      { status: 500 }
    );
  }
}