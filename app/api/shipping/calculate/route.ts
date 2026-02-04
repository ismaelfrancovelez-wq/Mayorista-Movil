import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

/* ===============================
   🔍 DISTANCIA (HAVERSINE)
=============================== */
function distanceKm(
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
   🧾 TIPOS
=============================== */
type Address = {
  lat: number;
  lng: number;
  area?: "caba" | "amba" | "interior";
};

/* ===============================
   📊 FUNCIÓN DE LOGGING MEJORADA
=============================== */
function logShippingError(error: unknown, context: Record<string, any>) {
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
  console.error("❌ SHIPPING CALCULATE ERROR:", JSON.stringify(errorDetails, null, 2));

  // ✅ TODO: Integrar con Sentry cuando esté disponible
  if (process.env.SENTRY_DSN) {
    try {
      // Sentry.captureException(error, {
      //   extra: context,
      //   tags: { service: 'shipping-calculate' }
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
      logShippingError(
        new Error("No hay retailerId en cookie"),
        { ...requestContext, step: "auth" }
      );
      
      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Usuario no autenticado. Se asignó retiro en fábrica por defecto.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       📦 BODY
    =============================== */
    const body = await req.json();
    const { productId, qty } = body;

    if (!productId || typeof qty !== "number" || qty <= 0) {
      logShippingError(
        new Error("Datos de entrada inválidos"),
        { ...requestContext, body, step: "validation" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Datos inválidos. Se asignó retiro en fábrica por defecto.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       📦 PRODUCTO
    =============================== */
    const productSnap = await db
      .collection("products")
      .doc(productId)
      .get();

    if (!productSnap.exists) {
      logShippingError(
        new Error("Producto no encontrado"),
        { ...requestContext, productId, step: "product_fetch" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Producto no encontrado. Se asignó retiro en fábrica por defecto.",
        },
        { status: 200 }
      );
    }

    const product = productSnap.data();
    if (!product || !product.factoryId) {
      logShippingError(
        new Error("Producto sin factoryId"),
        { ...requestContext, productId, productData: product, step: "product_validation" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Producto sin fabricante asociado. Se asignó retiro en fábrica.",
        },
        { status: 200 }
      );
    }

    const shippingConfig = product.shipping;

    /* ===============================
       🏭 FÁBRICA
    =============================== */
    const factorySnap = await db
      .collection("manufacturers")
      .doc(product.factoryId)
      .get();

    if (!factorySnap.exists) {
      logShippingError(
        new Error("Fábrica no encontrada"),
        { ...requestContext, factoryId: product.factoryId, step: "factory_fetch" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Fábrica no encontrada. Se asignó retiro en fábrica por defecto.",
        },
        { status: 200 }
      );
    }

    const factoryData = factorySnap.data();
    if (!factoryData || !factoryData.address) {
      logShippingError(
        new Error("Fábrica sin dirección"),
        { ...requestContext, factoryId: product.factoryId, step: "factory_address" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Fábrica sin dirección configurada. Se asignó retiro en fábrica.",
        },
        { status: 200 }
      );
    }

    const fAddr = factoryData.address as Address;

    /* ===============================
       🛒 RETAILER
    =============================== */
    const retailerSnap = await db
      .collection("retailers")
      .doc(retailerId)
      .get();

    if (!retailerSnap.exists) {
      logShippingError(
        new Error("Revendedor no encontrado"),
        { ...requestContext, retailerId, step: "retailer_fetch" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Revendedor no encontrado. Se asignó retiro en fábrica por defecto.",
        },
        { status: 200 }
      );
    }

    const retailerData = retailerSnap.data();
    if (!retailerData || !retailerData.address) {
      logShippingError(
        new Error("Revendedor sin dirección"),
        { ...requestContext, retailerId, step: "retailer_address" }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Revendedor sin dirección configurada. Se asignó retiro en fábrica.",
        },
        { status: 200 }
      );
    }

    const rAddr = retailerData.address as Address;

    if (
      typeof fAddr.lat !== "number" ||
      typeof fAddr.lng !== "number" ||
      typeof rAddr.lat !== "number" ||
      typeof rAddr.lng !== "number"
    ) {
      logShippingError(
        new Error("Direcciones incompletas o inválidas"),
        {
          ...requestContext,
          factoryAddress: fAddr,
          retailerAddress: rAddr,
          step: "address_validation",
        }
      );

      return NextResponse.json(
        {
          shippingMode: "pickup",
          shippingCost: 0,
          error: "Direcciones incompletas. Se asignó retiro en fábrica por defecto.",
        },
        { status: 200 }
      );
    }

    /* ===============================
       🔍 DISTANCIA
    =============================== */
    const km = distanceKm(
      fAddr.lat,
      fAddr.lng,
      rAddr.lat,
      rAddr.lng
    );

    /* ===============================
       🚚 APLICAR REGLAS DEL PRODUCTO
    =============================== */

    // ENVÍO PROPIO
    if (
      shippingConfig?.methods?.includes("own_logistics") &&
      shippingConfig.ownLogistics
    ) {
      const own = shippingConfig.ownLogistics;

      if (own.type === "per_km") {
        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: Math.round(km * own.pricePerKm),
        });
      }

      if (own.type === "zones") {
        let zone: "z1" | "z2" | "z3" = "z3";
        if (km <= 10) zone = "z1";
        else if (km <= 30) zone = "z2";

        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: own.zones[zone],
        });
      }

      if (own.type === "geographic") {
        const area = rAddr.area ?? "interior";

        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: own.areas[area],
        });
      }
    }

    // ENVÍO POR TERCEROS
    if (
      shippingConfig?.methods?.includes("third_party") &&
      shippingConfig.thirdParty
    ) {
      return NextResponse.json({
        shippingMode: "third_party",
        shippingCost: shippingConfig.thirdParty.fixedPrice,
      });
    }

    // RETIRO (DEFAULT)
    return NextResponse.json({
      shippingMode: "pickup",
      shippingCost: 0,
    });
    
  } catch (error) {
    // ✅ LOGGING COMPLETO DEL ERROR
    logShippingError(error, {
      ...requestContext,
      step: "unexpected_error",
    });

    // ✅ RESPUESTA SEGURA PARA EL CLIENTE
    return NextResponse.json(
      {
        shippingMode: "pickup",
        shippingCost: 0,
        error: "Ocurrió un error al calcular el envío. Se asignó retiro en fábrica por defecto.",
      },
      { status: 200 }
    );
  }
}
