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

  // ✅ Log detallado a consola
  console.error("❌ SHIPPING FRACCIONADO ERROR:", JSON.stringify(errorDetails, null, 2));

  // ✅ TODO: Integrar con Sentry cuando esté disponible
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
       🛒 RETAILER
    =============================== */
    const retailerSnap = await db
      .collection("retailers")
      .doc(retailerId)
      .get();

    if (!retailerSnap.exists) {
      logFraccionadoError(
        new Error("Revendedor no encontrado"),
        { ...requestContext, retailerId, step: "retailer_fetch" }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Revendedor no encontrado. Se asignó costo fijo por defecto.",
        },
        { status: 200 }
      );
    }

    const retailerData = retailerSnap.data();
    const retailerAddress = retailerData?.address as AddressFrac;

    if (
      !retailerAddress ||
      typeof retailerAddress.lat !== "number" ||
      typeof retailerAddress.lng !== "number"
    ) {
      logFraccionadoError(
        new Error("Dirección de revendedor inválida"),
        {
          ...requestContext,
          retailerId,
          retailerAddress,
          step: "retailer_address",
        }
      );

      return NextResponse.json(
        {
          shippingCost: FIXED_COST,
          error: "Revendedor sin dirección válida. Se asignó costo fijo.",
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