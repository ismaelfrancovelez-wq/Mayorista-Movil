import { NextResponse } from "next/server";
import { calculateFraccionadoShipping } from "../../../../lib/shipping";

export async function POST(req: Request) {
  try {
    // 1️⃣ Leemos el body que manda el frontend
    const body = await req.json();

    const { factoryAddress, retailerAddress } = body;

    // 2️⃣ Validaciones simples (muy importantes)
    if (!factoryAddress || !retailerAddress) {
      return NextResponse.json(
        { error: "Direcciones inválidas" },
        { status: 400 }
      );
    }

    // 3️⃣ Calculamos el envío usando la lógica central
    const result = await calculateFraccionadoShipping({
      factoryAddress,
      retailerAddress,
    });

    // 4️⃣ Respondemos al frontend con el resultado
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ Error calculando envío:", error);

    return NextResponse.json(
      { error: error.message ?? "Error interno" },
      { status: 500 }
    );
  }
}