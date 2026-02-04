import { NextResponse } from "next/server";
import { calculateShippingInternal } from "../../../../lib/shipping/calculateShippingInternal";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = calculateShippingInternal({
      shippingConfig: body.shipping, // 👈 nombre correcto
      factoryAddress: body.factoryAddress,
      retailerAddress: body.retailerAddress,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Error calculando retiro en fábrica" },
      { status: 400 }
    );
  }
}
