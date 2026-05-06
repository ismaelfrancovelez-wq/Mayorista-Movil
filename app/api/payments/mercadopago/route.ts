// app/api/payments/mercadopago/route.ts
//
// Endpoint para pedidos DIRECTOS (no fraccionados).
// Recibe el método de pago elegido por el cliente y crea preferencia adecuada.
//
// REFACTOR: eliminada toda lógica de comisión 4%. El precio que llega
// es el final ya con surcharge aplicado en el cliente vía
// lib/pricing/commission.ts. Vos recibís siempre el productSubtotal limpio.

import { NextResponse } from "next/server";
import { createSplitPreference } from "../../../../lib/mercadopago-split";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import rateLimit from "../../../../lib/rate-limit";
import {
  PaymentMethod,
  calculateFinalPrice,
  PAYMENT_METHODS_META,
} from "../../../../lib/pricing/commission";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export const dynamic = "force-dynamic";

/**
 * Mapea un PaymentMethod del selector a los `excluded_payment_types` que MP necesita
 * para que el Checkout solo muestre la opción correspondiente.
 */
function getExcludedTypes(method: PaymentMethod): { id: string }[] {
  switch (method) {
    case "checkout_credit":
      return [{ id: "ticket" }, { id: "atm" }, { id: "debit_card" }];
    case "checkout_debit":
      return [{ id: "ticket" }, { id: "atm" }, { id: "credit_card" }];
    case "checkout_money_in_mp":
      return [{ id: "ticket" }, { id: "atm" }, { id: "credit_card" }, { id: "debit_card" }];
    case "checkout_prepaid":
      return [{ id: "ticket" }, { id: "atm" }, { id: "credit_card" }];
    case "checkout_installments":
      return [{ id: "ticket" }, { id: "atm" }, { id: "debit_card" }];
    default:
      return [];
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ||
             req.headers.get("x-real-ip") ||
             "unknown";

  try {
    await limiter.check(10, ip);
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Por favor, espera un minuto." },
      { status: 429 }
    );
  }

  try {
    const userId = cookies().get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      basePrice,            // ✅ NUEVO: precio limpio (sin surcharge)
      paymentMethod,        // ✅ NUEVO: método elegido por el cliente
      originalQty,
      orderType,
      lotType,
      productId,
      shippingMode,
      shippingCost = 0,
      MF,
    } = body;

    // ── Validaciones ──
    if (!originalQty || !Number.isFinite(Number(originalQty))) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    if (!basePrice || basePrice <= 0) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }
    if (!paymentMethod || !(paymentMethod in PAYMENT_METHODS_META)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://mayoristamovil.com");

    // ── Datos del producto y fábrica ──
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const productData = productSnap.data()!;
    const factoryId = productData.factoryId;

    const factorySnap = await db.collection("manufacturers").doc(factoryId).get();
    const factoryData = factorySnap.data();
    const factoryMPUserId = factoryData?.mercadopago?.user_id || null;

    const tipo = orderType === "fraccionada" ? "fraccionada" : "directa";
    const withShipping = shippingMode !== "pickup";

    // ── CÁLCULO CORRECTO DEL PRECIO FINAL ──
    // El cliente paga el surcharge correspondiente a su método.
    // Vos recibís el basePrice limpio.
    const productTotalBase = basePrice;  // limpio para vos
    const grossBeforeMP = productTotalBase + shippingCost;  // lo que tiene que recibir tu cuenta limpia
    const finalPriceForClient = calculateFinalPrice(grossBeforeMP, paymentMethod);

    console.log("💰 Cálculo de precio:", {
      paymentMethod,
      basePrice,
      shippingCost,
      grossBeforeMP,
      finalPriceForClient,
      surcharge: finalPriceForClient - grossBeforeMP,
    });

    // ── Crear preferencia MP ──
    const preference = await createSplitPreference({
      title,
      unit_price: Math.round(finalPriceForClient),
      quantity: 1,

      metadata: {
        productId,
        factoryId,
        qty: originalQty,
        tipo,
        withShipping,
        orderType,
        lotType,
        retailerId: userId,
        original_qty: originalQty,
        MF,
        shippingCost,
        shippingMode,
        paymentMethod,    // ✅ NUEVO
        commission: 0,    // legacy, ya no se usa
      },

      back_urls: {
        success: `${baseUrl}/success`,
        failure: `${baseUrl}/failure`,
        pending: `${baseUrl}/pending`,
      },

      factoryMPUserId,
      shippingCost,
      productTotal: productTotalBase,
      commission: 0,    // legacy

      excluded_payment_types: getExcludedTypes(paymentMethod as PaymentMethod),
    });

    return NextResponse.json({
      init_point: preference.init_point,
      finalPrice: finalPriceForClient,
    });
  } catch (error: any) {
    console.error("Error MP:", error);
    return NextResponse.json({ error: "Error iniciando pago" }, { status: 500 });
  }
}