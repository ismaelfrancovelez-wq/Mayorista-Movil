// app/api/products/create/route.ts
// ✅ MODIFICADO:
//   - stock=0 ya NO desactiva el producto (active siempre es true)
//   - El badge "Sin stock" lo muestra el frontend en ExplorarClient
//   - ✅ NUEVO: se guarda "nameLower" para poder hacer búsquedas por nombre
//   - ✅ NUEVO: se guarda "retailReferencePrice" y "retailReferencePriceSource"
//   - ✅ NUEVO: se guardan "colors" por presentación
//   - ✅ NUEVO: el precio se guarda con 4% de comisión ya aplicado

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validateShippingConfig } from "../../../../lib/shipping/validateShippingConfig";
import rateLimit from "../../../../lib/rate-limit";

const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  try {
    await limiter.check(500, ip);
  } catch {
    return NextResponse.json({ error: "Demasiados intentos. Por favor, espera un minuto." }, { status: 429 });
  }

  try {
    const userId = cookies().get("userId")?.value;
    const activeRole = cookies().get("activeRole")?.value;

    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const sellerRoles = ["manufacturer", "distributor", "wholesaler"];
    if (!activeRole || !sellerRoles.includes(activeRole)) {
      return NextResponse.json({ error: "Solo fabricantes, distribuidores o mayoristas pueden crear productos" }, { status: 403 });
    }

    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });

    const userData = userSnap.data();
    const userType = userData?.usertype;
    const activeRoleDB = userData?.activeRole;
    const roles = userData?.roles || [];

    const hasSellerRole =
      sellerRoles.includes(userType) ||
      sellerRoles.includes(activeRoleDB) ||
      roles.some((r: string) => sellerRoles.includes(r));

    if (!hasSellerRole) return NextResponse.json({ error: "No tenés permiso para crear productos" }, { status: 403 });

    const sellerType = sellerRoles.includes(activeRole) ? activeRole : sellerRoles.includes(activeRoleDB) ? activeRoleDB : userType;
    const factoryId = userId;
    const body = await req.json();

    if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "Nombre de producto inválido" }, { status: 400 });
    if (!body.description || typeof body.description !== "string" || body.description.trim().length < 10) return NextResponse.json({ error: "La descripción debe tener al menos 10 caracteres" }, { status: 400 });
    if (typeof body.price !== "number" || body.price <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    if (typeof body.minimumOrder !== "number" || body.minimumOrder <= 0) return NextResponse.json({ error: "Pedido mínimo inválido" }, { status: 400 });
    if (typeof body.netProfitPerUnit !== "number" || body.netProfitPerUnit < 0) return NextResponse.json({ error: "Ganancia neta inválida" }, { status: 400 });

    let stockValue: number | null = null;
    if (body.stock !== null && body.stock !== undefined && body.stock !== "") {
      const parsedStock = Number(body.stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return NextResponse.json({ error: "El stock debe ser un número entero igual o mayor a 0" }, { status: 400 });
      }
      stockValue = parsedStock;
    }

    // ✅ NUEVO: validar precio minorista si viene en el body
    let retailReferencePriceValue: number | null = null;
    if (body.retailReferencePrice !== null && body.retailReferencePrice !== undefined && body.retailReferencePrice !== "") {
      const parsed = Number(body.retailReferencePrice);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: "Precio minorista de referencia inválido" }, { status: 400 });
      }
      retailReferencePriceValue = parsed > 0 ? parsed : null;
    }

    if (!body.shipping) return NextResponse.json({ error: "Falta configuración de envío" }, { status: 400 });
    validateShippingConfig(body.shipping);

    // Limpiar y validar minimums
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

    const productRef = await db.collection("products").add({
      factoryId,
      sellerType,
      name: body.name,
      nameLower: body.name.toLowerCase().trim(),
      description: body.description.trim(),
      unitLabel: typeof body.unitLabel === "string" && body.unitLabel.trim() ? body.unitLabel.trim().substring(0, 30) : null,
      price: Math.round(body.price * 1.04), // ✅ 4% aplicado
      minimumOrder: body.minimumOrder,
      netProfitPerUnit: body.netProfitPerUnit,
      category: body.category || "otros",
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
      shipping: body.shipping,
      minimums: cleanMinimums,
      variants: [],
      stock: stockValue,
      retailReferencePrice: retailReferencePriceValue,
      retailReferencePriceSource: retailReferencePriceValue ? "manual" : null,
      featured: false,
      featuredUntil: null,
      active: true,
      isIntermediary: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, productId: productRef.id });

  } catch (error: any) {
    console.error("❌ CREATE PRODUCT ERROR:", error);
    return NextResponse.json({ error: error?.message ?? "Error al crear producto" }, { status: 400 });
  }
}