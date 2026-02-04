// app/api/admin/products/mark-intermediary/route.ts

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/auth/requireAdmin";
import { db } from "../../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    // 🔒 SOLO ADMIN puede marcar productos como intermediarios
    await requireAdmin();

    const body = await req.json();
    
    const { productId, isIntermediary } = body;

    // Validar que se envió el productId
    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "ID de producto inválido" },
        { status: 400 }
      );
    }

    // Validar que isIntermediary es booleano
    if (typeof isIntermediary !== "boolean") {
      return NextResponse.json(
        { error: "El valor de isIntermediary debe ser true o false" },
        { status: 400 }
      );
    }

    // Verificar que el producto existe
    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    // Actualizar el producto con el flag de intermediario
    await productRef.update({
      isIntermediary: isIntermediary,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: isIntermediary 
        ? "Producto marcado como intermediario" 
        : "Marca de intermediario removida",
    });

  } catch (error: any) {
    console.error("❌ ERROR AL MARCAR PRODUCTO COMO INTERMEDIARIO:", error);
    
    return NextResponse.json(
      { error: error?.message || "Error al actualizar producto" },
      { status: 400 }
    );
  }
}