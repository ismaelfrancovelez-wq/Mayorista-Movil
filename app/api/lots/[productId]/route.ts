import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

export async function GET(
  req: Request,
  { params }: { params: { productId: string } }
) {
  try {
    const { adminDb } = await getAdminServices();
    const productId = params.productId;

    if (!productId) {
      return NextResponse.json({ accumulatedQty: 0, MF: 0 });
    }

    const snap = await adminDb
      .collection("lots")
      .doc(productId)
      .get();

    if (!snap.exists) {
      return NextResponse.json({ accumulatedQty: 0, MF: 0 });
    }

    const data = snap.data();

    return NextResponse.json({
      accumulatedQty: data?.accumulatedQty ?? 0,
      MF: data?.MF ?? 0,
    });
  } catch (error) {
    console.error("ERROR LOTS:", error);
    return NextResponse.json(
      { error: "Error cargando lote" },
      { status: 500 }
    );
  }
}