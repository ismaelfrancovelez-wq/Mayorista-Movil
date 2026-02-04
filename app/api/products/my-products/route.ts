import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;
    const role = cookies().get("activeRole")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    if (role !== "manufacturer") {
      return NextResponse.json(
        { error: "Solo fabricantes pueden acceder a esta ruta" },
        { status: 403 }
      );
    }

    const snapshot = await db
      .collection("products")
      .where("factoryId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const products = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        minimumOrder: data.minimumOrder,
        category: data.category || "otros",
        imageUrl: data.imageUrl || null, // 🆕 AGREGAR imageUrl
        active: data.active !== false,
        featured: data.featured || false,
        featuredUntil: data.featuredUntil?.toDate()?.toISOString() || null,
        createdAt: data.createdAt?.toDate()?.toISOString() || null,
      };
    });

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
    });

  } catch (error) {
    console.error("❌ MY PRODUCTS ERROR:", error);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}