// app/api/products/my-products/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        description: data.description || "",         // ✅ para edición
        price: data.price,
        minimumOrder: data.minimumOrder,
        netProfitPerUnit: data.netProfitPerUnit || 0, // ✅ para edición
        category: data.category || "otros",
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [], // ✅ actualizado
        shipping: data.shipping || null,              // ✅ para edición
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