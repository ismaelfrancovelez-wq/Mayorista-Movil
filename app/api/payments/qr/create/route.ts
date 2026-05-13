// app/api/payments/qr/create/route.ts
// Genera un QR dinámico de MP para una reserva con método de pago QR.
// Solo aplica al flujo de reserva (lot_closed → /pagar/[id]).
// Devuelve qr_image (base64 PNG) para que el cliente la muestre inline.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../../lib/firebase-admin";
import { createQROrder, pickPosId } from "../../../../../lib/mercadopago-qr";
import { getPriceBreakdown, PaymentMethod } from "../../../../../lib/pricing/commission";
import rateLimit from "../../../../../lib/rate-limit";
import QRCode from "qrcode"; // npm install qrcode @types/qrcode

const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });

export const dynamic = "force-dynamic";

const QR_COLLECTOR_ID = process.env.MP_COLLECTOR_ID ?? "";
const QR_STORE_ID     = process.env.MP_QR_STORE_ID ?? "";
const QR_POS_IDS      = (process.env.MP_QR_POS_IDS ?? "").split(",").filter(Boolean);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  try { await limiter.check(10, ip); } catch {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }

  try {
    const userId = cookies().get("userId")?.value;
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!QR_COLLECTOR_ID || !QR_STORE_ID || QR_POS_IDS.length === 0) {
      console.error("❌ QR no configurado: faltan MP_COLLECTOR_ID / MP_QR_STORE_ID / MP_QR_POS_IDS");
      return NextResponse.json({ error: "QR no disponible temporalmente" }, { status: 503 });
    }

    const body = await req.json();
    const { reservationId } = body as { reservationId: string };

    if (!reservationId) {
      return NextResponse.json({ error: "Falta reservationId" }, { status: 400 });
    }

    const resSnap = await db.collection("reservations").doc(reservationId).get();
    if (!resSnap.exists) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const reservation = resSnap.data()!;

    if (reservation.retailerId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (reservation.status === "paid") {
      return NextResponse.json({ error: "Ya fue pagada" }, { status: 409 });
    }
    if (reservation.status !== "lot_closed") {
      return NextResponse.json({ error: "El lote aún no cerró" }, { status: 400 });
    }

    const paymentMethod = reservation.paymentMethod as PaymentMethod;
    if (!paymentMethod?.startsWith("qr_")) {
      return NextResponse.json(
        { error: "Método de pago no es QR" },
        { status: 400 }
      );
    }

    const breakdown = getPriceBreakdown(reservation.totalFinal, paymentMethod);
    const finalPrice = breakdown.finalPrice;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://mayoristamovil.com");

    // Elegir POS del pool (round-robin simple)
    const posId = pickPosId(QR_POS_IDS, Math.floor(Date.now() / 1000));

    const qrResult = await createQROrder({
      collectorId: QR_COLLECTOR_ID,
      storeId:     QR_STORE_ID,
      posId,
      externalReference: reservationId,
      title:             `Pago lote: ${reservation.productName}`,
      totalAmount:       finalPrice,
      notificationUrl:   `${baseUrl}/api/webhooks/mercadopago`,
    });

    // Generar imagen QR desde el string EMVCo
    const qrImage = await QRCode.toDataURL(qrResult.qr_data, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    // Guardar tracking en la reserva
    await db.collection("reservations").doc(reservationId).update({
      qrPosId:     posId,
      qrCreatedAt: new Date().toISOString(),
      qrAmount:    finalPrice,
    });

    return NextResponse.json({
      qr_image:        qrImage,       // data:image/png;base64,…
      qr_data:         qrResult.qr_data,
      amount:          finalPrice,
      expiresSeconds:  600,           // 10 minutos (configurable en MP dashboard)
    });
  } catch (error: any) {
    console.error("❌ Error creando QR:", error);
    return NextResponse.json({ error: "Error generando QR" }, { status: 500 });
  }
}