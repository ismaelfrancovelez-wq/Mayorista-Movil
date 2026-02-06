import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getAdminServices } from "../../../../lib/firebase-admin";

export async function GET() {
  try {
    const { adminDb } = await getAdminServices();

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
        imageUrl: data.imageUrl || null, // 🆕 AGREGAR imageUrl
        featured: data.featured || false, // 🆕 AGREGAR featured para el explorador
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