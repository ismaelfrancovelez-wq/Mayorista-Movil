// app/api/products/edit/route.ts

import { NextResponse } from "next/server";
import { requireSellerRole } from "../../../../lib/auth/requireRole";
import { validateShippingConfig } from "../../../../lib/shipping/validateShippingConfig";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import rateLimit from "../../../../lib/rate-limit";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    await limiter.check(10, ip);
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Por favor, espera un minuto." },
      { status: 429 }
    );
  }

  try {
    const userId = await requireSellerRole();
    const body = await req.json();

    if (!body.productId || typeof body.productId !== "string") {
      return NextResponse.json({ error: "productId requerido" }, { status: 400 });
    }

    const productRef = db.collection("products").doc(body.productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (productSnap.data()!.factoryId !== userId) {
      return NextResponse.json({ error: "Este producto no te pertenece" }, { status: 403 });
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Nombre de producto inválido" }, { status: 400 });
    }

    if (!body.description || typeof body.description !== "string" || body.description.trim().length < 10) {
      return NextResponse.json({ error: "La descripción debe tener al menos 10 caracteres" }, { status: 400 });
    }

    if (typeof body.price !== "number" || body.price <= 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }

    if (typeof body.minimumOrder !== "number" || body.minimumOrder <= 0) {
      return NextResponse.json({ error: "Pedido mínimo inválido" }, { status: 400 });
    }

    if (typeof body.netProfitPerUnit !== "number" || body.netProfitPerUnit < 0) {
      return NextResponse.json({ error: "Ganancia neta inválida" }, { status: 400 });
    }

    if (!body.shipping) {
      return NextResponse.json({ error: "Falta configuración de envío" }, { status: 400 });
    }

    validateShippingConfig(body.shipping);

    const cleanVariants = Array.isArray(body.variants)
      ? body.variants
          .map((v: any) => ({
            unitLabel: String(v.unitLabel || "").trim().substring(0, 20),
            price: Number(v.price),
            minimumOrder: Number(v.minimumOrder),
          }))
          .filter((v: any) => v.unitLabel && v.price > 0 && v.minimumOrder > 0)
      : [];

    let stockValue: number | null = null;
    if (body.stock !== null && body.stock !== undefined && body.stock !== "") {
      const parsedStock = Number(body.stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return NextResponse.json(
          { error: "El stock debe ser un número entero igual o mayor a 0" },
          { status: 400 }
        );
      }
      stockValue = parsedStock;
    }

    await productRef.update({
      name: body.name.trim().substring(0, 100),
      // ✅ NUEVO: nameLower se actualiza junto con name
      nameLower: body.name.trim().substring(0, 100).toLowerCase(),
      description: body.description.trim().substring(0, 1000),
      price: body.price,
      minimumOrder: body.minimumOrder,
      netProfitPerUnit: body.netProfitPerUnit,
      category: body.category || "otros",
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
      shipping: body.shipping,
      unitLabel: typeof body.unitLabel === "string" && body.unitLabel.trim()
        ? body.unitLabel.trim().substring(0, 20)
        : null,
      variants: cleanVariants,
      stock: stockValue,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ EDIT PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error al editar producto" },
      { status: 400 }
    );
  }
}