// app/api/payments/transferencia/init/route.ts
//
// Recibe SOLO el reservationId. El paymentMethod ya está guardado en la reserva
// desde que el cliente reservó. Crea la preferencia MP con surcharge correspondiente.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";
import { createSplitPreference } from "../../../../../lib/mercadopago-split";
import {
  PaymentMethod,
  PAYMENT_METHODS_META,
  getPriceBreakdown,
} from "../../../../../lib/pricing/commission";
import rateLimit from "../../../../../lib/rate-limit";

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export const dynamic = "force-dynamic";

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
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    await limiter.check(10, ip);
  } catch {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un minuto." },
      { status: 429 }
    );
  }

  try {
    const userId = cookies().get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { reservationId } = body;
    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId" }, { status: 400 });
    }

    const reservationSnap = await db.collection("reservations").doc(reservationId).get();
    if (!reservationSnap.exists) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }
    const reservation = reservationSnap.data()!;

    if (reservation.retailerId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (reservation.status === "paid") {
      return NextResponse.json({ error: "Esta reserva ya fue pagada" }, { status: 409 });
    }
    if (reservation.status !== "lot_closed") {
      return NextResponse.json({ error: "El lote aún no está listo para pago" }, { status: 400 });
    }

    const paymentMethod = reservation.paymentMethod as PaymentMethod | undefined;
    if (!paymentMethod || !(paymentMethod in PAYMENT_METHODS_META)) {
      return NextResponse.json(
        { error: "Reserva sin método de pago válido. Contactá al soporte." },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://mayoristamovil.com");

    if (paymentMethod.startsWith("checkout_") || paymentMethod.startsWith("qr_")) {
      const factorySnap = await db.collection("manufacturers").doc(reservation.factoryId).get();
      const factoryMPUserId = factorySnap.data()?.mercadopago?.user_id || null;

      const isPickup = reservation.shippingMode === "pickup";
      const lotType = isPickup ? "fraccionado_retiro" : "fraccionado_envio";

      const breakdown = getPriceBreakdown(reservation.totalFinal, paymentMethod);
      const finalPriceForClient = breakdown.finalPrice;

      const preference = await createSplitPreference({
        title: `Pago lote: ${reservation.productName}`,
        unit_price: Math.round(finalPriceForClient),
        quantity: 1,
        metadata: {
          productId: reservation.productId,
          factoryId: reservation.factoryId,
          qty: reservation.qty,
          tipo: "fraccionada",
          withShipping: !isPickup,
          orderType: "fraccionado",
          lotType,
          retailerId: reservation.retailerId,
          original_qty: reservation.qty,
          MF: 0,
          shippingCost: reservation.shippingCostFinal || 0,
          shippingMode: reservation.shippingMode,
          paymentMethod,
          commission: 0,
          reservationId,
          lotId: reservation.lotId,
        },
        back_urls: {
          success: `${baseUrl}/success`,
          failure: `${baseUrl}/failure`,
          pending: `${baseUrl}/pending`,
        },
        factoryMPUserId,
        shippingCost: reservation.shippingCostFinal || 0,
        productTotal: reservation.productSubtotal || 0,
        commission: 0,
        excluded_payment_types: getExcludedTypes(paymentMethod),
      });

      return NextResponse.json({ init_point: preference.init_point });
    }

    if (paymentMethod === "prometeo_transfer") {
      return NextResponse.json(
        { error: "Transferencia tradicional no disponible aún. Contactá al soporte." },
        { status: 501 }
      );
    }

    return NextResponse.json({ error: "Método no soportado" }, { status: 400 });
  } catch (error: any) {
    console.error("❌ Error en transferencia/init:", error);
    return NextResponse.json(
      { error: "Error iniciando pago. Intentá de nuevo." },
      { status: 500 }
    );
  }
}