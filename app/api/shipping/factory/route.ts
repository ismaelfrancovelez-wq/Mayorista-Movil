import { NextResponse } from "next/server";
import { calculateZoneShipping } from "../../../../lib/shipping/zones";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { distanceKm, kmZones } = body;

    if (
      typeof distanceKm !== "number" ||
      !kmZones ||
      typeof kmZones.z1 !== "number" ||
      typeof kmZones.z2 !== "number" ||
      typeof kmZones.z3 !== "number"
    ) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    const result = calculateZoneShipping(distanceKm, kmZones);

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ SHIPPING FACTORY ERROR:", error);
    return NextResponse.json(
      { error: "Error calculando envío" },
      { status: 500 }
    );
  }
}