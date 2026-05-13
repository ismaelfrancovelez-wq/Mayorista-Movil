// lib/mercadopago-qr.ts
// Utilidades para QR dinámico de MP Argentina (interoperable CVU).
// El cliente escanea el QR desde cualquier app bancaria/billetera.
// MP notifica el pago via webhook tipo "merchant_order".

const MP_BASE = "https://api.mercadopago.com";

function mpHeaders(idempotencyKey?: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN!}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) h["X-Idempotency-Key"] = idempotencyKey;
  return h;
}

export interface QROrderResult {
  qr_data: string;           // string EMVCo → se pasa a qrcode para generar imagen
  in_store_order_id?: string;
}

/**
 * Crea (o reemplaza) la orden QR dinámica en el POS indicado.
 * ⚠️ Un POS solo soporta UNA orden activa. Usá el pool de POSes para concurrencia.
 */
export async function createQROrder(params: {
  collectorId: string;
  storeId: string;
  posId: string;
  externalReference: string;
  title: string;
  totalAmount: number;
  notificationUrl: string;
}): Promise<QROrderResult> {
  const { collectorId, storeId, posId, externalReference, title, totalAmount, notificationUrl } = params;

  const url =
    `${MP_BASE}/instore/orders/qr/seller/collectors/${collectorId}` +
    `/stores/${storeId}/pos/${posId}/qrs`;

  const amount = Math.round(totalAmount * 100) / 100;

  const res = await fetch(url, {
    method: "PUT",
    headers: mpHeaders(`qr-${externalReference}`),
    body: JSON.stringify({
      external_reference: externalReference,
      title,
      description: title,
      notification_url: notificationUrl,
      total_amount: amount,
      items: [
        {
          sku_number: externalReference,
          category: "marketplace",
          title,
          description: title,
          unit_price: amount,
          quantity: 1,
          unit_measure: "unit",
          total_amount: amount,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MP QR error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Cancela la orden QR activa del POS (cuando el usuario abandona).
 */
export async function deleteQROrder(params: {
  collectorId: string;
  storeId: string;
  posId: string;
}): Promise<void> {
  const { collectorId, storeId, posId } = params;
  await fetch(
    `${MP_BASE}/instore/orders/qr/seller/collectors/${collectorId}/stores/${storeId}/pos/${posId}/qrs`,
    { method: "DELETE", headers: mpHeaders() }
  );
}

export interface MerchantOrder {
  id: number;
  status: string;
  order_status: string;
  external_reference: string;
  payments: Array<{
    id: number;
    transaction_amount: number;
    status: string;
  }>;
}

/**
 * Busca merchant orders por external_reference.
 * Usar en polling de status desde el frontend o desde el webhook como fallback.
 */
export async function getMerchantOrdersByReference(
  externalReference: string
): Promise<MerchantOrder[]> {
  const res = await fetch(
    `${MP_BASE}/merchant_orders/search?external_reference=${encodeURIComponent(externalReference)}`,
    { headers: mpHeaders() }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.elements || [];
}

/**
 * Reserva un POS del pool usando un índice simple basado en Firestore.
 * Para producción con alta concurrencia: usar transacción atómica en Firestore.
 */
export function pickPosId(posIds: string[], seed: number): string {
  return posIds[seed % posIds.length];
}