import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const snap = await db
      .collection("manufacturers")
      .doc(userId)
      .get();

    if (!snap.exists) {
      return NextResponse.json({ address: null });
    }

    return NextResponse.json({
      address: snap.data()?.address ?? null,
    });
  } catch (error) {
    console.error("❌ Get address:", error);
    return NextResponse.json(
      { error: "Error obteniendo dirección" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { formattedAddress, lat, lng } = await req.json();

    if (
      !formattedAddress ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    await db
      .collection("manufacturers")
      .doc(userId)
      .set(
        {
          address: {
            formattedAddress,
            lat,
            lng,
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Save address:", error);
    return NextResponse.json(
      { error: "Error guardando dirección" },
      { status: 500 }
    );
  }
}
