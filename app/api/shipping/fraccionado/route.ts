// app/api/shipping/fraccionado/route.ts
// ✅ OPCIÓN A: Envío solo en primera compra del lote

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { calculateFraccionadoShipping } from "../../../../lib/shipping";

/* ===============================
   📊 FUNCIÓN DE LOGGING
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

// ✅ NUEVO: busca la dirección del vendedor en las 3 colecciones posibles
async function getSellerAddress(factoryId: string, sellerType?: string): Promise<string | null> {
  const collectionsToTry: string[] = [];

  if (sellerType === "distributor") {
    collectionsToTry.push("distributors");
  } else if (sellerType === "wholesaler") {
    collectionsToTry.push("wholesalers");
  } else if (sellerType === "manufacturer") {
    collectionsToTry.push("manufacturers");
  } else {
    // Sin sellerType: probar las 3
    collectionsToTry.push("manufacturers", "distributors", "wholesalers");
  }

  for (const collection of collectionsToTry) {
    const snap = await db.collection(collection).doc(factoryId).get();
    if (snap.exists) {
      const address = snap.data()?.address?.formattedAddress;
      if (address) return address as string;
    }
  }

  return null;
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
    const { productId } = body;

    if (!productId) {
      logFraccionadoError(
        new Error("productId faltante"),
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
      logFraccionadoError(
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
    if (!product?.factoryId) {
      logFraccionadoError(
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

    /* ===============================
       🏭 VENDEDOR (fabricante, distribuidor o mayorista)
       ✅ CORREGIDO: busca en la colección correcta
    =============================== */
    const factoryAddressText = await getSellerAddress(
      product.factoryId,
      product.sellerType
    );

    if (!factoryAddressText) {
      logFraccionadoError(
        new Error("Dirección del vendedor no encontrada"),
        {
          ...requestContext,
          factoryId: product.factoryId,
          sellerType: product.sellerType,
          step: "factory_address",
        }
      );

      return NextResponse.json(
        {
          error: "El vendedor no configuró su dirección. No se puede calcular envío.",
          missingAddress: true,
          missingAddressType: "factory",
          availableModes: [],
        },
        { status: 200 }
      );
    }

    /* ===============================
       🛒 RETAILER
    =============================== */
    let retailerData: any = null;
    let retailerAddressText: string | null = null;

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
      
      const userSnap = await db
        .collection("users")
        .doc(retailerId)
        .get();

      if (userSnap.exists) {
        console.log("✅ Usuario encontrado en colección 'users'");
        const userData = userSnap.data();
        retailerData = userData;
        retailerAddressText = userData?.address?.formattedAddress ?? null;
      } else {
        logFraccionadoError(
          new Error("Usuario no encontrado en ninguna colección"),
          { ...requestContext, retailerId, step: "user_not_found_anywhere" }
        );

        return NextResponse.json(
          {
            error: "Usuario no encontrado",
          },
          { status: 404 }
        );
      }
    }

    // ✅ OPCIÓN A: BLOQUEAR si falta dirección de revendedor
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
          error: "Configurá tu dirección en tu perfil para calcular el envío",
          missingAddress: true,
          missingAddressType: "retailer",
          availableModes: [],
        },
        { status: 200 }
      );
    }

    /* ===============================
       🔍 VERIFICAR SI ESTE RETAILER YA PAGÓ ENVÍO EN ESTE LOTE
    =============================== */
    const [accumulatingSnap, openSnap] = await Promise.all([
      db.collection("lots").where("productId", "==", productId).where("status", "==", "accumulating").limit(1).get(),
      db.collection("lots").where("productId", "==", productId).where("status", "==", "open").limit(1).get(),
    ]);

    const activeLotDoc = !accumulatingSnap.empty
      ? accumulatingSnap.docs[0]
      : !openSnap.empty
      ? openSnap.docs[0]
      : null;

    let isFirstPurchase = true;

    if (activeLotDoc) {
      const lotId = activeLotDoc.id;

      const [myPaymentSnap, myReservationSnap] = await Promise.all([
        db.collection("payments")
          .where("lotId", "==", lotId)
          .where("buyerId", "==", retailerId)
          .limit(1)
          .get(),
        db.collection("reservations")
          .where("lotId", "==", lotId)
          .where("retailerId", "==", retailerId)
          .where("status", "in", ["pending_lot", "lot_closed", "paid"])
          .limit(1)
          .get(),
      ]);

      if (!myPaymentSnap.empty || !myReservationSnap.empty) {
        isFirstPurchase = false;
        console.log(`⚠️ Retailer ${retailerId} ya tiene actividad en lote ${lotId} → envío $0`);
      } else {
        console.log(`✅ Retailer ${retailerId} es nuevo en lote ${lotId} → cobra envío`);
      }
    } else {
      console.log("✅ Lote nuevo → cobra envío");
    }

    /* ===============================
       🔍 CALCULAR DISTANCIA
    =============================== */
    const result = await calculateFraccionadoShipping({
      factoryAddress: factoryAddressText,
      retailerAddress: retailerAddressText,
    });

    /* ===============================
       💰 COSTO FINAL
    =============================== */
    const shippingCost = isFirstPurchase ? result.totalCost : 0;

    console.log("✅ Costo de envío calculado:", {
      baseToFactory: Math.round(result.kmBaseToFactory * 10) / 10,
      factoryToRetailer: Math.round(result.kmFactoryToRetailer * 10) / 10,
      totalKm: Math.round(result.kmCharged * 10) / 10,
      isFirstPurchase: isFirstPurchase,
      shippingCost: shippingCost,
    });

    return NextResponse.json({
      shippingMode: "platform",
      shippingCost: shippingCost,
      isFirstPurchase: isFirstPurchase,
      km: Math.round(result.kmCharged * 10) / 10,
    });
    
  } catch (error) {
    logFraccionadoError(error, {
      ...requestContext,
      step: "unexpected_error",
    });

    return NextResponse.json(
      {
        error: "Ocurrió un error al calcular el envío fraccionado",
      },
      { status: 500 }
    );
  }
}