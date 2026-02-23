import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

export const dynamic = "force-dynamic";

// ✅ FIX ERROR 18: Cuántos productos devolver por página
const PAGE_SIZE = 20;

export async function GET(req: Request) {
  try {
    const { adminDb } = await getAdminServices();

    // ✅ FIX ERROR 18: Leer el parámetro ?page= de la URL (por defecto página 1)
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    const snap = await adminDb
      .collection("products")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE)
      .offset(offset)
      .get();

    const hasMore = snap.docs.length === PAGE_SIZE;

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

    return NextResponse.json({
      products,
      page,
      pageSize: PAGE_SIZE,
      hasMore,
    });
  } catch (err) {
    console.error("❌ EXPLORE PRODUCTS ERROR:", err);
    return NextResponse.json(
      { error: "Error al cargar productos" },
      { status: 500 }
    );
  }
}