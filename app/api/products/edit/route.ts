// app/api/products/edit/route.ts
// ✅ NUEVO: el precio se guarda con 4% de comisión ya aplicado

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
    await limiter.check(100, ip);
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

    const cleanMinimums = Array.isArray(body.minimums)
      ? body.minimums
          .map((m: any) => ({
            type: m.type === "amount" ? "amount" : "quantity",
            value: Number(m.value),
            formats: Array.isArray(m.formats)
              ? m.formats
                  .map((f: any) => ({
                    unitLabel: String(f.unitLabel || "").trim().substring(0, 30),
                    unitsPerPack: Math.max(1, Number(f.unitsPerPack) || 1),
                    price: Math.round(Number(f.price) * 1.04), // ✅ 4% aplicado
                    colors: Array.isArray(f.colors) ? f.colors.map((c: any) => String(c).trim()).filter(Boolean) : [],
                  }))
                  .filter((f: any) => f.unitLabel && f.price > 0)
              : [],
          }))
          .filter((m: any) => m.value > 0 && m.formats.length > 0)
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

    // ✅ precio minorista de referencia
    // Si viene null o vacío → se borra (el fabricante lo eliminó)
    // Si viene un número > 0 → se guarda como "manual"
    // Si no viene en el body (undefined) → no se toca lo que ya había
    let retailPriceUpdate: Record<string, any> = {};
    if (body.retailReferencePrice !== undefined) {
      const parsed = Number(body.retailReferencePrice);
      if (body.retailReferencePrice === null || body.retailReferencePrice === "" || parsed <= 0) {
        retailPriceUpdate = {
          retailReferencePrice: null,
          retailReferencePriceSource: null,
        };
      } else {
        retailPriceUpdate = {
          retailReferencePrice: parsed,
          retailReferencePriceSource: "manual",
        };
      }
    }

    await productRef.update({
      name: body.name.trim().substring(0, 100),
      nameLower: body.name.trim().substring(0, 100).toLowerCase(),
      description: body.description.trim().substring(0, 1000),
      price: Math.round(body.price * 1.04), // ✅ 4% aplicado
      minimumOrder: body.minimumOrder,
      netProfitPerUnit: body.netProfitPerUnit,
      category: body.category || "otros",
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
      shipping: body.shipping,
      unitLabel: typeof body.unitLabel === "string" && body.unitLabel.trim()
        ? body.unitLabel.trim().substring(0, 30)
        : null,
      minimums: cleanMinimums,
      variants: [],
      stock: stockValue,
      ...retailPriceUpdate,
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