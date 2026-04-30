// app/api/products/my-products/route.ts
// ✅ BLOQUE A: devuelve solo price BASE. La comisión MP se calcula en runtime.

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

    const sellerRoles = ["manufacturer", "distributor", "wholesaler"];
    if (!role || !sellerRoles.includes(role)) {
      return NextResponse.json(
        { error: "Solo vendedores pueden acceder a esta ruta" },
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
        description: data.description || "",
        price: data.price, // ✅ BLOQUE A: solo BASE
        minimumOrder: data.minimumOrder,
        netProfitPerUnit: data.netProfitPerUnit || 0,
        category: data.category || "otros",
        unitLabel: data.unitLabel || null,
        minimums: Array.isArray(data.minimums) ? data.minimums : [],
        variants: Array.isArray(data.variants) ? data.variants : [],
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        shipping: data.shipping || null,
        active: data.active !== false,
        featured: data.featured || false,
        featuredUntil: data.featuredUntil?.toDate()?.toISOString() || null,
        createdAt: data.createdAt?.toDate()?.toISOString() || null,
        stock: data.stock !== undefined ? data.stock : null,
        retailReferencePrice: data.retailReferencePrice ?? null,
        retailReferencePriceSource: data.retailReferencePriceSource ?? null,
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