import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

// ✅ OPTIMIZACIÓN: Caché de 10 segundos (actualización rápida)
export const revalidate = 10;

export async function GET() {
  try {
    const { adminDb } = await getAdminServices();

    // ✅ OPTIMIZACIÓN: Sin límite - Paginación en frontend
    const snap = await adminDb
      .collection("products")
      .where("active", "==", true)
      .get();

    const products = snap.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        minimumOrder: data.minimumOrder,
        category: data.category || "otros",
        factoryId: data.factoryId,
        imageUrl: data.imageUrl || null,
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods ?? [],
      };
    });

    return NextResponse.json({ products });
  } catch (err) {
    console.error("❌ EXPLORE PRODUCTS ERROR:", err);
    return NextResponse.json(
      { error: "Error al cargar productos" },
      { status: 500 }
    );
  }
}