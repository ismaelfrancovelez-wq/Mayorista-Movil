import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const factoryId = searchParams.get("factoryId");

    if (!factoryId) {
      return NextResponse.json({ error: "factoryId requerido" }, { status: 400 });
    }

    const snap = await db.collection("manufacturers").doc(factoryId).get();

    if (!snap.exists) {
      return NextResponse.json({ connected: false });
    }

    const data = snap.data()!;
    const mpData = data.mercadopago;

    return NextResponse.json({
      connected: !!mpData?.access_token,
    });
  } catch (error) {
    console.error("Error verificando estado MP:", error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}