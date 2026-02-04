// app/api/products/delete/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const userId = cookies().get("userId")?.value;
    const role = cookies().get("activeRole")?.value;

    if (!userId || role !== "manufacturer") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { productId } = await req.json();

    if (!productId) {
      return NextResponse.json(
        { error: "productId requerido" },
        { status: 400 }
      );
    }

    // Verificar que el producto pertenece al fabricante
    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const productData = productSnap.data()!;

    if (productData.factoryId !== userId) {
      return NextResponse.json(
        { error: "Este producto no te pertenece" },
        { status: 403 }
      );
    }

    // Verificar si hay pedidos activos asociados
    const activeLots = await db
      .collection("lots")
      .where("productId", "==", productId)
      .where("status", "==", "accumulating")
      .get();

    if (!activeLots.empty) {
      return NextResponse.json(
        { error: "No se puede borrar. Hay pedidos fraccionados activos para este producto" },
        { status: 400 }
      );
    }

    // Borrar el producto
    await productRef.delete();

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente",
    });

  } catch (error) {
    console.error("❌ Error borrando producto:", error);
    return NextResponse.json(
      { error: "Error al borrar producto" },
      { status: 500 }
    );
  }
}