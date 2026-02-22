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

    // ✅ FIX ERROR 4: Buscar lotes con status "open" O "accumulating"
    // Antes solo buscaba "open" y los lotes nuevos usan "accumulating"
    const snap = await db
      .collection("lots")
      .where("productId", "==", productId)
      .where("status", "in", ["open", "accumulating"])
      .get();

    let withShipping = {
      accumulatedQty: 0,
      MF: 0,
      percentage: 0,
    };

    let withoutShipping = {
      accumulatedQty: 0,
      MF: 0,
      percentage: 0,
    };

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const MF = data.MF ?? 0;
      const accumulated = data.accumulatedQty ?? 0;
      const percentage =
        MF > 0 ? Math.min(accumulated / MF, 1) * 100 : 0;

      if (data.type === "fraccionado_envio") {
        withShipping = { accumulatedQty: accumulated, MF, percentage };
      }

      if (data.type === "fraccionado_retiro") {
        withoutShipping = { accumulatedQty: accumulated, MF, percentage };
      }
    });

    const missingQty =
      Math.max(
        withShipping.MF || withoutShipping.MF,
        0
      ) -
      Math.max(
        withShipping.accumulatedQty,
        withoutShipping.accumulatedQty
      );

    return NextResponse.json({
      minimumOrder:
        withShipping.MF || withoutShipping.MF || 0,
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