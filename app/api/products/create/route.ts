// app/api/products/create/route.ts
// ✅ MODIFICADO:
//   - stock=0 ya NO desactiva el producto (active siempre es true)
//   - El badge "Sin stock" lo muestra el frontend en ExplorarClient

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

    // ✅ STOCK: null = sin control | 0 = sin stock (pero sigue activo) | >0 = con stock
    let stockValue: number | null = null;
    if (body.stock !== null && body.stock !== undefined && body.stock !== "") {
      const parsedStock = Number(body.stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return NextResponse.json({ error: "El stock debe ser un número entero igual o mayor a 0" }, { status: 400 });
      }
      stockValue = parsedStock;
    }

    if (!body.shipping) return NextResponse.json({ error: "Falta configuración de envío" }, { status: 400 });
    validateShippingConfig(body.shipping);

    const productRef = await db.collection("products").add({
      factoryId,
      sellerType,
      name: body.name,
      description: body.description.trim(),
      unitLabel: typeof body.unitLabel === "string" && body.unitLabel.trim() ? body.unitLabel.trim().substring(0, 20) : null,
      price: body.price,
      minimumOrder: body.minimumOrder,
      netProfitPerUnit: body.netProfitPerUnit,
      category: body.category || "otros",
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
      shipping: body.shipping,
      variants: Array.isArray(body.variants)
        ? body.variants
            .map((v: any) => ({
              unitLabel: String(v.unitLabel || "").trim().substring(0, 20),
              price: Number(v.price),
              minimumOrder: Number(v.minimumOrder),
            }))
            .filter((v: any) => v.unitLabel && v.price > 0 && v.minimumOrder > 0)
        : [],

      // ✅ stock: null = sin control | 0 = sin stock | >0 = disponible
      stock: stockValue,

      featured: false,
      featuredUntil: null,

      // ✅ SIEMPRE true: stock=0 muestra badge pero NO oculta el producto
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