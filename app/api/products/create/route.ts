import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { validateShippingConfig } from "../../../../lib/shipping/validateShippingConfig";
import rateLimit from "../../../../lib/rate-limit";

// ✅ Crear el limitador
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minuto
  uniqueTokenPerInterval: 500,
});

export async function POST(req: Request) {
  // ✅ Verificar rate limit
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    await limiter.check(5, ip); // Máximo 5 productos por minuto
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Por favor, espera un minuto." },
      { status: 429 }
    );
  }

  try {
    /* ===============================
       🔒 SOLO VENDEDORES AUTORIZADOS
       Acepta: fabricante, distribuidor o mayorista
    =============================== */
    const userId = cookies().get("userId")?.value;
    const activeRole = cookies().get("activeRole")?.value;

    // Verificar que el usuario esté logueado
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // ✅ Verificar que tenga un rol de vendedor válido
    const sellerRoles = ["manufacturer", "distributor", "wholesaler"];
    if (!activeRole || !sellerRoles.includes(activeRole)) {
      return NextResponse.json(
        { error: "Solo fabricantes, distribuidores o mayoristas pueden crear productos" },
        { status: 403 }
      );
    }

    // ✅ Verificar en base de datos que el rol sea real
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 }
      );
    }

    const userData = userSnap.data();
    const userType = userData?.usertype;
    const activeRoleDB = userData?.activeRole;
    const roles = userData?.roles || [];

    const hasSellerRole =
      sellerRoles.includes(userType) ||
      sellerRoles.includes(activeRoleDB) ||
      roles.some((r: string) => sellerRoles.includes(r));

    if (!hasSellerRole) {
      return NextResponse.json(
        { error: "No tenés permiso para crear productos" },
        { status: 403 }
      );
    }

    // ✅ El sellerType es el rol activo del usuario
    // Si activeRole de la cookie es válido lo usamos, sino usamos el de la DB
    const sellerType = sellerRoles.includes(activeRole)
      ? activeRole
      : sellerRoles.includes(activeRoleDB)
      ? activeRoleDB
      : userType;

    const factoryId = userId;

    const body = await req.json();

    /* ===============================
       📦 VALIDACIONES BÁSICAS
    =============================== */

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Nombre de producto inválido" },
        { status: 400 }
      );
    }

    // ✅ Validación de descripción obligatoria
    if (
      !body.description ||
      typeof body.description !== "string" ||
      body.description.trim().length < 10
    ) {
      return NextResponse.json(
        { error: "La descripción debe tener al menos 10 caracteres" },
        { status: 400 }
      );
    }

    if (typeof body.price !== "number" || body.price <= 0) {
      return NextResponse.json(
        { error: "Precio inválido" },
        { status: 400 }
      );
    }

    if (typeof body.minimumOrder !== "number" || body.minimumOrder <= 0) {
      return NextResponse.json(
        { error: "Pedido mínimo inválido" },
        { status: 400 }
      );
    }

    /* ===============================
       💰 GANANCIA NETA (INFORMATIVA)
    =============================== */

    if (
      typeof body.netProfitPerUnit !== "number" ||
      body.netProfitPerUnit < 0
    ) {
      return NextResponse.json(
        { error: "Ganancia neta inválida" },
        { status: 400 }
      );
    }

    /* ===============================
       🚚 VALIDACIÓN DE SHIPPING
    =============================== */

    if (!body.shipping) {
      return NextResponse.json(
        { error: "Falta configuración de envío" },
        { status: 400 }
      );
    }

    validateShippingConfig(body.shipping);

    /* ===============================
       💾 GUARDAR PRODUCTO
    =============================== */

    const productRef = await db.collection("products").add({
      factoryId, // 🔒 siempre desde cookie / rol

      // ✅ NUEVO: guardar el tipo de vendedor automáticamente
      sellerType,

      name: body.name,
      description: body.description.trim(),

      // etiqueta de unidad opcional ("500g", "1kg", "750ml", etc.)
      unitLabel:
        typeof body.unitLabel === "string" && body.unitLabel.trim()
          ? body.unitLabel.trim().substring(0, 20)
          : null,

      price: body.price,
      minimumOrder: body.minimumOrder,

      // 💰 solo informativo
      netProfitPerUnit: body.netProfitPerUnit,

      // ✅ categoría del producto
      category: body.category || "otros",

      // 🖼️ imágenes del producto (array de URLs)
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],

      // 🚚 reglas de envío
      shipping: body.shipping,

      // ✅ NUEVO: variantes de medida/precio/mínimo
      variants: Array.isArray(body.variants) ? body.variants.map((v: any) => ({
        unitLabel: String(v.unitLabel || "").trim().substring(0, 20),
        price: Number(v.price),
        minimumOrder: Number(v.minimumOrder),
      })).filter((v: any) => v.unitLabel && v.price > 0 && v.minimumOrder > 0) : [],

      // ⭐ destacados
      featured: false,
      featuredUntil: null,

      // 📊 estado
      active: true,

      // Por defecto NO es intermediario
      // Solo el admin podrá cambiarlo después
      isIntermediary: false,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      productId: productRef.id,
    });
  } catch (error: any) {
    console.error("❌ CREATE PRODUCT ERROR:", error);

    return NextResponse.json(
      { error: error?.message ?? "Error al crear producto" },
      { status: 400 }
    );
  }
}