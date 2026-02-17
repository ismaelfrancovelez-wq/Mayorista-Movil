// app/api/shipping/fraccionado/route.ts
// ✅ VERSIÓN CORREGIDA - Usa Google Maps Distance Matrix API (distancias reales por calles)

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { calculateFraccionadoShipping } from "../../../../lib/shipping";

/* ===============================
   💲 REGLAS DE COSTO
=============================== */
const FIXED_COST = 3500;

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

    // ✅ CORREGIDO: usar formattedAddress (texto) para Google Maps Distance Matrix API
    const factoryAddressText = factoryData?.address?.formattedAddress as string | undefined;

    if (!factoryAddressText) {
      logFraccionadoError(
        new Error("Dirección de fábrica inválida"),
        {
          ...requestContext,
          factoryId: product.factoryId,
          factoryAddress: factoryData?.address,
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
    let retailerAddressText: string | null = null;

    // 1️⃣ Intentar en retailers
    const retailerSnap = await db
      .collection("retailers")
      .doc(retailerId)
      .get();

    if (retailerSnap.exists) {
      console.log("✅ Retailer encontrado en colección 'retailers'");
      retailerData = retailerSnap.data();
      retailerAddressText = retailerData?.address?.formattedAddress ?? null;
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
        retailerAddressText = userData?.address?.formattedAddress ?? null;
        
        // Si el usuario no tiene dirección, asignar costo fijo
        if (!retailerAddressText) {
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
    if (!retailerAddressText) {
      console.warn("⚠️  Dirección inválida o faltante:", retailerData?.address);
      
      logFraccionadoError(
        new Error("Dirección de usuario inválida o faltante"),
        {
          ...requestContext,
          retailerId,
          retailerAddress: retailerData?.address,
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
       ✅ CORREGIDO: Google Maps Distance Matrix API en vez de Haversine
    =============================== */
    const result = await calculateFraccionadoShipping({
      factoryAddress: factoryAddressText,
      retailerAddress: retailerAddressText,
    });

    /* ===============================
       💰 COSTO FINAL
    =============================== */
    console.log("✅ Costo de envío calculado:", {
      baseToFactory: Math.round(result.kmBaseToFactory * 10) / 10,
      factoryToRetailer: Math.round(result.kmFactoryToRetailer * 10) / 10,
      totalKm: Math.round(result.kmCharged * 10) / 10,
      shippingCost: result.totalCost,
    });

    return NextResponse.json({
      shippingMode: "platform",
      shippingCost: result.totalCost,
      km: Math.round(result.kmCharged * 10) / 10,
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