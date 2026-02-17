// app/api/shipping/calculate/route.ts
// ✅ ACTUALIZADO - roundTrip configurable + OPCIÓN A (bloquear sin dirección)

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { env } from "../../../../lib/env";

/* ===============================
   📊 FUNCIÓN DE LOGGING
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

  console.error("❌ SHIPPING CALCULATE ERROR:", JSON.stringify(errorDetails, null, 2));

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

/* ===============================
   🔍 CALCULAR DISTANCIA CON GOOGLE MAPS
=============================== */
async function getDistanceKm(origin: string, destination: string): Promise<number> {
  const apiKey = env.googleMaps.apiKey();

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no configurada");
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/distancematrix/json"
  );

  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "ar");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (
    data.status !== "OK" ||
    data.rows[0].elements[0].status !== "OK"
  ) {
    throw new Error(
      `Error calculando distancia: ${data.status} / ${data.rows?.[0]?.elements?.[0]?.status}`
    );
  }

  return data.rows[0].elements[0].distance.value / 1000;
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
          error: "Usuario no autenticado",
          missingAuth: true,
        },
        { status: 401 }
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
          error: "Datos inválidos",
        },
        { status: 400 }
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
          error: "Producto no encontrado",
        },
        { status: 404 }
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
          error: "Producto sin fabricante asociado",
        },
        { status: 400 }
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
          error: "Fábrica no encontrada",
        },
        { status: 404 }
      );
    }

    const factoryData = factorySnap.data();
    const factoryAddressText = factoryData?.address?.formattedAddress as string | undefined;

    // ✅ OPCIÓN A: BLOQUEAR si falta dirección de fábrica
    if (!factoryAddressText) {
      logShippingError(
        new Error("Fábrica sin dirección"),
        { ...requestContext, factoryId: product.factoryId, factoryAddress: factoryData?.address, step: "factory_address" }
      );

      return NextResponse.json(
        {
          error: "La fábrica no configuró su dirección. Solo podés elegir retiro en fábrica.",
          missingAddress: true,
          missingAddressType: "factory",
          availableModes: shippingConfig.methods.includes("factory_pickup") ? ["pickup"] : [],
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
      logShippingError(
        new Error("Revendedor no encontrado"),
        { ...requestContext, retailerId, step: "retailer_fetch" }
      );

      return NextResponse.json(
        {
          error: "Revendedor no encontrado",
        },
        { status: 404 }
      );
    }

    const retailerData = retailerSnap.data();
    const retailerAddressText = retailerData?.address?.formattedAddress as string | undefined;

    // ✅ OPCIÓN A: BLOQUEAR si falta dirección de revendedor
    if (!retailerAddressText) {
      logShippingError(
        new Error("Revendedor sin dirección"),
        { ...requestContext, retailerId, retailerAddress: retailerData?.address, step: "retailer_address" }
      );

      return NextResponse.json(
        {
          error: "Configurá tu dirección en tu perfil para ver opciones de envío",
          missingAddress: true,
          missingAddressType: "retailer",
          availableModes: shippingConfig.methods.includes("factory_pickup") ? ["pickup"] : [],
        },
        { status: 200 }
      );
    }

    /* ===============================
       🔍 CALCULAR DISTANCIA CON GOOGLE MAPS
    =============================== */
    const km = await getDistanceKm(factoryAddressText, retailerAddressText);

    /* ===============================
       🚚 APLICAR REGLAS DEL PRODUCTO
    =============================== */

    // ENVÍO PROPIO
    if (
      shippingConfig?.methods?.includes("own_logistics") &&
      shippingConfig.ownLogistics
    ) {
      const own = shippingConfig.ownLogistics;

      // ✅ PER KM: CON OPCIÓN DE IDA O IDA Y VUELTA
      if (own.type === "per_km") {
        const kmToCharge = own.roundTrip ? km * 2 : km;
        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: Math.round(kmToCharge * own.pricePerKm),
          km: Math.round(km * 10) / 10,
          kmCharged: Math.round(kmToCharge * 10) / 10,
          roundTrip: own.roundTrip,
        });
      }

      // ✅ ZONAS: 4 zonas (z1, z2, z3, z4) - SOLO IDA
      if (own.type === "zones") {
        let zone: "z1" | "z2" | "z3" | "z4" = "z4";
        if (km <= 15) zone = "z1";       // 0-15km
        else if (km <= 35) zone = "z2";  // 15-35km
        else if (km <= 60) zone = "z3";  // 35-60km
        // else z4 (+60km)

        return NextResponse.json({
          shippingMode: "factory",
          shippingCost: own.zones[zone],
          km: Math.round(km * 10) / 10,
          zone: zone,
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
    logShippingError(error, {
      ...requestContext,
      step: "unexpected_error",
    });

    return NextResponse.json(
      {
        error: "Ocurrió un error al calcular el envío",
      },
      { status: 500 }
    );
  }
}