import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth/requireRole";
import { validateShippingConfig } from "../../../../lib/shipping/validateShippingConfig";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import rateLimit from "../../../../lib/rate-limit";

// ✅ Crear el limitador
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minuto
  uniqueTokenPerInterval: 500,
});

export async function POST(req: Request) {
  // ✅ Verificar rate limit
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  
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
       🔒 SOLO FABRICANTES
    =============================== */
    const factoryId = await requireRole("manufacturer");

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

    // ✅ NUEVO: Validación de descripción obligatoria
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

    if (
      typeof body.minimumOrder !== "number" ||
      body.minimumOrder <= 0
    ) {
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

      name: body.name,
      description: body.description.trim(),

      // etiqueta de unidad opcional ("500g", "1kg", "750ml", etc.)
      unitLabel: typeof body.unitLabel === "string" && body.unitLabel.trim()
        ? body.unitLabel.trim().substring(0, 20)
        : null,

      price: body.price,
      minimumOrder: body.minimumOrder,

      // 💰 solo informativo
      netProfitPerUnit: body.netProfitPerUnit,

      // ✅ categoría del producto
      category: body.category || "otros",

      // 🖼️ imágenes del producto (array de URLs) - ✅ ACTUALIZADO
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],

      // 🚚 reglas de envío
      shipping: body.shipping,

      // ⭐ destacados
      featured: false,
      featuredUntil: null,

      // 📊 estado
      active: true,

      // 🆕 NUEVO: Por defecto NO es intermediario
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

    /* ===============================
       ⚠️ ERROR CONTROLADO
    =============================== */
    return NextResponse.json(
      { error: error?.message ?? "Error al crear producto" },
      { status: 400 }
    );
  }
}