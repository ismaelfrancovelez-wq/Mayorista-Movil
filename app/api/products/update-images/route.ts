import { NextResponse } from "next/server";
import { requireSellerRole } from "../../../../lib/auth/requireRole";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const userId = await requireSellerRole();
    const { productId, imageUrls } = await req.json();

    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "productId requerido" }, { status: 400 });
    }

    if (!Array.isArray(imageUrls)) {
      return NextResponse.json({ error: "imageUrls debe ser un array" }, { status: 400 });
    }

    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (productSnap.data()!.factoryId !== userId) {
      return NextResponse.json({ error: "Este producto no te pertenece" }, { status: 403 });
    }

    await productRef.update({
      imageUrls,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ UPDATE IMAGES ERROR:", error);
    return NextResponse.json({ error: error?.message ?? "Error" }, { status: 400 });
  }
}