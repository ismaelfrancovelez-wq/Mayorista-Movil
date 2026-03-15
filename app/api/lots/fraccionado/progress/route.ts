import { NextResponse } from "next/server";
import { db } from "../../../../../lib/firebase-admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const snap = await db
      .collection("lots")
      .where("productId", "==", productId)
      .where("status", "in", ["open", "accumulating"])
      .get();

    let withShipping = { accumulatedQty: 0, MF: 0, percentage: 0 };
    let withoutShipping = { accumulatedQty: 0, MF: 0, percentage: 0 };

    snap.docs.forEach((doc) => {
      const data = doc.data();

      // ✅ soporta legacy (MF) y nuevo (minimumOrder)
      const MF = data.minimumOrder ?? data.MF ?? 0;
      const accumulated = data.accumulatedQty ?? 0;
      const percentage = MF > 0 ? Math.min(accumulated / MF, 1) * 100 : 0;

      // ✅ soporta tipos legacy y nuevos
      if (data.type === "fraccionado_envio" || data.type === "fractional_shipping") {
        withShipping = { accumulatedQty: accumulated, MF, percentage };
      }

      if (data.type === "fraccionado_retiro" || data.type === "fractional_pickup") {
        withoutShipping = { accumulatedQty: accumulated, MF, percentage };
      }
    });

    const missingQty =
      Math.max(withShipping.MF, withoutShipping.MF, 0) -
      Math.max(withShipping.accumulatedQty, withoutShipping.accumulatedQty, 0);

    return NextResponse.json({
      minimumOrder: withShipping.MF || withoutShipping.MF || 0,
      withShipping,
      withoutShipping,
      missingQty: Math.max(missingQty, 0),
    });
  } catch (err) {
    console.error("❌ FRACCIONADO PROGRESS ERROR:", err);
    return NextResponse.json(
      { error: "Error cargando progreso fraccionado" },
      { status: 500 }
    );
  }
}