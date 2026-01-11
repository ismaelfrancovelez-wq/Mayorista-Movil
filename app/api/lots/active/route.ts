import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "productId requerido" },
        { status: 400 }
      );
    }

    const lotRef = db.collection("lots").doc(productId);
    const snap = await lotRef.get();

    // 🟡 Si no existe, el lote está vacío
    if (!snap.exists) {
      return NextResponse.json({
        productId,
        accumulatedQty: 0,
        MF: 0,
        status: "open",
        progress: 0,
        isComplete: false,
      });
    }

    const data = snap.data()!;
    const accumulatedQty = data.accumulatedQty ?? 0;
    const MF = data.MF ?? 0;

    const isComplete = MF > 0 && accumulatedQty >= MF;

    return NextResponse.json({
      productId,
      accumulatedQty,
      MF,
      status: isComplete ? "closed" : "open",
      progress: MF > 0 ? Math.min(accumulatedQty / MF, 1) : 0,
      isComplete,
      updatedAt: data.updatedAt ?? null,
    });
  } catch (error) {
    console.error("❌ ERROR ACTIVE LOT:", error);
    return NextResponse.json(
      { error: "Error obteniendo lote activo" },
      { status: 500 }
    );
  }
}