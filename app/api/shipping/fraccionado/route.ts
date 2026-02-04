// app/api/shipping/fraccionado/route.ts
// 🔧 VERSIÓN CORREGIDA - Busca en users Y retailers

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

/* ===============================
   🔍 DISTANCIA (HAVERSINE)
=============================== */
function distanceKmFrac(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* ===============================
   🔍 BASE PLATAFORMA (FIJA)
=============================== */
const PLATFORM_BASE = {
  lat: -34.6059, // Poeta Romildo Rizzo 3244
  lng: -58.6427, // William Morris, Hurlingham
};

/* ===============================
   💲 REGLAS DE COSTO
=============================== */
const PRICE_PER_KM = 85;
const FIXED_COST = 3500;

type AddressFrac = {
  lat: number;
  lng: number;
};

/* ===============================
   📊 FUNCIÓN DE LOGGING MEJORADA
=============================== */
function logFraccionadoError(error: unknown, context: Record<string, any>) {
  const errorDetails = {
    timestamp: new Date().toISOString(),
    context,
    error: {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name || typeof error,
    },
  };

  console.error("❌ SHIPPING FRACCIONADO ERROR:", JSON.stringify(errorDetails, null, 2));

  if (process.env.SENTRY_DSN) {
    try {
      // Sentry.captureException(error, {
      //   extra: context,
      //   tags: { service: 'shipping-fraccionado' }
      // });
    } catch (sentryError) {
      console.error("❌ Error al enviar a Sentry:", sentryError);
    }
  }

  return errorDetails;
}

export async function POST(req: Request) {
  const requestContext = {
    url: req.url,
    method: req.method,
  };

  try {
    /* ===============================
       🔐 RETAILER DESDE COOKIE
    =============================== */
    const retailerId = cookies().get("userId")?.value;

    if (!retailerId) {
      logFraccionadoError(
        new Error("No hay retailerId en cookie"),
        { ...requestContext, step: "auth" }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Usuario no autenticado. Se asignó costo fijo por defecto.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       📦 BODY
    =============================== */
    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      logFraccionadoError(
        new Error("productId faltante"),
        { ...requestContext, body, step: "validation" }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Datos inválidos. Se asignó costo fijo por defecto.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       📦 PRODUCTO → FACTORY
    =============================== */
    const productSnap = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!productSnap.exists) {
      logFraccionadoError(
        new Error("Producto no encontrado"),
        { ...requestContext, productId, step: "product_fetch" }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Producto no encontrado. Se asignó costo fijo por defecto.",
        },
        { status: 200 }
      );
    }

    const product = productSnap.data();
    if (!product?.factoryId) {
      logFraccionadoError(
        new Error("Producto sin factoryId"),
        { ...requestContext, productId, productData: product, step: "product_validation" }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Producto sin fabricante asociado. Se asignó costo fijo.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       🏭 FÁBRICA
    =============================== */
    const factorySnap = await db
      .collection("manufacturers")
      .doc(product.factoryId)
      .get();

    if (!factorySnap.exists) {
      logFraccionadoError(
        new Error("Fábrica no encontrada"),
        { ...requestContext, factoryId: product.factoryId, step: "factory_fetch" }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Fábrica no encontrada. Se asignó costo fijo por defecto.",
        },
        { status: 200 }
      );
    }

    const factoryData = factorySnap.data();
    const factoryAddress = factoryData?.address as AddressFrac;

    if (
      !factoryAddress ||
      typeof factoryAddress.lat !== "number" ||
      typeof factoryAddress.lng !== "number"
    ) {
      logFraccionadoError(
        new Error("Dirección de fábrica inválida"),
        {
          ...requestContext,
          factoryId: product.factoryId,
          factoryAddress,
          step: "factory_address",
        }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Fábrica sin dirección válida. Se asignó costo fijo.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       🛒 RETAILER - BÚSQUEDA MEJORADA
       Busca primero en retailers, luego en users
    =============================== */
    let retailerData: any = null;
    let retailerAddress: AddressFrac | null = null;

    // 1️⃣ Intentar en retailers
    const retailerSnap = await db
      .collection("retailers")
      .doc(retailerId)
      .get();

    if (retailerSnap.exists) {
      console.log("✅ Retailer encontrado en colección 'retailers'");
      retailerData = retailerSnap.data();
      retailerAddress = retailerData?.address;
    } else {
      console.log("⚠️  Retailer NO encontrado en 'retailers', buscando en 'users'...");
      
      // 2️⃣ Si no existe en retailers, buscar en users
      const userSnap = await db
        .collection("users")
        .doc(retailerId)
        .get();

      if (userSnap.exists) {
        console.log("✅ Usuario encontrado en colección 'users'");
        const userData = userSnap.data();
        retailerData = userData;
        retailerAddress = userData?.address || null;
        
        // Si el usuario no tiene dirección, asignar costo fijo
        if (!retailerAddress) {
          console.warn("⚠️  Usuario sin dirección configurada");
        }
      } else {
        // No existe ni en retailers ni en users
        logFraccionadoError(
          new Error("Usuario no encontrado en ninguna colección"),
          { ...requestContext, retailerId, step: "user_not_found_anywhere" }
        );

        return NextResponse.json(
          {
            shippingCost: FIXED_COST,
            error: "Usuario no encontrado. Se asignó costo fijo por defecto.",
          },
          { status: 200 }
        );
      }
    }

    // 3️⃣ Validar que tenga dirección válida
    if (
      !retailerAddress ||
      typeof retailerAddress.lat !== "number" ||
      typeof retailerAddress.lng !== "number"
    ) {
      console.warn("⚠️  Dirección inválida o faltante:", retailerAddress);
      
      logFraccionadoError(
        new Error("Dirección de usuario inválida o faltante"),
        {
          ...requestContext,
          retailerId,
          retailerAddress,
          step: "retailer_address_invalid",
        }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Dirección inválida. Se asignó costo fijo. Por favor, configura tu dirección en el perfil.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       🔍 DISTANCIAS
    =============================== */
    const baseToFactory = distanceKmFrac(
      PLATFORM_BASE.lat,
      PLATFORM_BASE.lng,
      factoryAddress.lat,
      factoryAddress.lng
    );

    const factoryToRetailer = distanceKmFrac(
      factoryAddress.lat,
      factoryAddress.lng,
      retailerAddress.lat,
      retailerAddress.lng
    );

    // ida + vuelta
    const totalKm = (baseToFactory + factoryToRetailer) * 2;

    /* ===============================
       💰 COSTO FINAL
    =============================== */
    const shippingCost =
      Math.round(totalKm * PRICE_PER_KM) + FIXED_COST;

    console.log("✅ Costo de envío calculado:", {
      baseToFactory: Math.round(baseToFactory * 10) / 10,
      factoryToRetailer: Math.round(factoryToRetailer * 10) / 10,
      totalKm: Math.round(totalKm * 10) / 10,
      shippingCost,
    });

    return NextResponse.json({
      shippingMode: "platform",
      shippingCost,
      km: Math.round(totalKm * 10) / 10,
    });
    
  } catch (error) {
    // ✅ LOGGING COMPLETO DEL ERROR
    logFraccionadoError(error, {
      ...requestContext,
      step: "unexpected_error",
    });

    // ✅ RESPUESTA SEGURA PARA EL CLIENTE
    return NextResponse.json(
      {
        shippingCost: FIXED_COST,
        error: "Ocurrió un error al calcular el envío fraccionado. Se asignó costo fijo por defecto.",
      },
      { status: 200 }
    );
  }
}