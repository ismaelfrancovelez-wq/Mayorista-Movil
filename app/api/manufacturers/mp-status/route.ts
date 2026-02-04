import { NextResponse } from "next/server";
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

    const snap = await db.collection("manufacturers").doc(userId).get();

    if (!snap.exists) {
      return NextResponse.json({ connected: false });
    }

    const data = snap.data()!;
    const mpData = data.mercadopago;

    return NextResponse.json({
      connected: !!mpData?.access_token,
      email: mpData?.email || null,
    });
  } catch (error) {
    console.error("Error verificando estado MP:", error);
    return NextResponse.json(
      { error: "Error al verificar estado" },
      { status: 500 }
    );
  }
}