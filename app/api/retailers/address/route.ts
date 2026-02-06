import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

/* ===============================
   GET → OBTENER DIRECCIÓN
================================ */
export async function GET() {
  const userId = cookies().get("userId")?.value;

  if (!userId) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  const snap = await db
    .collection("retailers")
    .doc(userId)
    .get();

  if (!snap.exists) {
    return NextResponse.json({ address: null });
  }

  return NextResponse.json({
    address: snap.data()?.address || null,
  });
}

/* ===============================
   POST → GUARDAR DIRECCIÓN
================================ */
export async function POST(req: Request) {
  const userId = cookies().get("userId")?.value;

  if (!userId) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { formattedAddress, lat, lng } = body;

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
    .collection("retailers")
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
}
