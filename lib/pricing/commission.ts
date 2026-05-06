// lib/pricing/commission.ts
//
// Single source of truth de comisiones por método de pago.
// Las tasas incluyen IVA sobre comisión (21% sobre la comisión MP).
//
// FUENTE: panel oficial Mercado Pago de MayoristaMovil (verificado).
// Última actualización: ver COMMISSIONS_LAST_VERIFIED.

export const COMMISSIONS_LAST_VERIFIED = "2025-05-06";

// ============================================================
// MÉTODOS DE PAGO SOPORTADOS
// ============================================================

export type PaymentMethod =
  // QR / Transferencia 3.0 (rápido y barato)
  | "qr_money_in_mp"          // Dinero en MP via QR — 0,968%, instantáneo
  | "qr_debit"                 // Débito via QR — 1,0769%, 2 días
  | "qr_installments"          // Cuotas sin tarjeta via QR — 1,7061%, instantáneo
  | "qr_credit"                // Crédito via QR — 5,566%, 10 días
  // Checkout MP (flexible, más caro y lento)
  | "checkout_credit"          // Crédito via Checkout — 4,2955%, 18 días
  | "checkout_debit"           // Débito via Checkout — 4,2955%, 18 días
  | "checkout_money_in_mp"     // Dinero en MP via Checkout — 4,2955%, 18 días
  | "checkout_installments"    // Cuotas sin tarjeta via Checkout — 4,2955%, 18 días
  | "checkout_prepaid"         // Prepaga via Checkout — 4,2955%, 18 días
  // Prometeo (transferencia tradicional, sin MP)
  | "prometeo_transfer";       // Transferencia bancaria — 0,50%, 5-15min

// ============================================================
// COMISIONES TOTALES (incluyen IVA sobre comisión)
// ============================================================

export const PAYMENT_METHOD_COMMISSIONS: Record<PaymentMethod, number> = {
  // QR
  qr_money_in_mp: 0.00968,
  qr_debit: 0.010769,
  qr_installments: 0.017061,
  qr_credit: 0.05566,
  // Checkout
  checkout_credit: 0.042955,
  checkout_debit: 0.042955,
  checkout_money_in_mp: 0.042955,
  checkout_installments: 0.042955,
  checkout_prepaid: 0.042955,
  // Prometeo
  prometeo_transfer: 0.0050,
};

// ============================================================
// METADATA PARA UI
// ============================================================

export type PaymentChannel = "qr" | "checkout" | "prometeo";

export interface PaymentMethodMeta {
  id: PaymentMethod;
  channel: PaymentChannel;
  label: string;
  description: string;
  /** % visible al cliente (ya con IVA). Ej: 0.968 */
  surchargePercent: number;
  /** Días de acreditación */
  releaseDays: string;
  badge?: "mas_barato" | "instantaneo" | "recomendado" | null;
  icon: string;
}

export const PAYMENT_METHODS_META: Record<PaymentMethod, PaymentMethodMeta> = {
  // ────── QR ──────
  qr_money_in_mp: {
    id: "qr_money_in_mp",
    channel: "qr",
    label: "QR — Dinero en Mercado Pago",
    description: "Pagá escaneando el QR con la app de Mercado Pago.",
    surchargePercent: 0.968,
    releaseDays: "Al instante",
    badge: "mas_barato",
    icon: "📱",
  },
  qr_debit: {
    id: "qr_debit",
    channel: "qr",
    label: "QR — Tarjeta de débito",
    description: "Escaneá el QR y pagá con débito desde la app de MP.",
    surchargePercent: 1.0769,
    releaseDays: "2 días",
    badge: null,
    icon: "📱",
  },
  qr_installments: {
    id: "qr_installments",
    channel: "qr",
    label: "QR — Cuotas sin tarjeta",
    description: "Escaneá el QR y pagá en cuotas sin tarjeta desde MP.",
    surchargePercent: 1.7061,
    releaseDays: "Al instante",
    badge: null,
    icon: "📱",
  },
  qr_credit: {
    id: "qr_credit",
    channel: "qr",
    label: "QR — Tarjeta de crédito",
    description: "Escaneá el QR y pagá con crédito desde la app de MP.",
    surchargePercent: 5.566,
    releaseDays: "10 días",
    badge: null,
    icon: "📱",
  },
  // ────── Checkout ──────
  checkout_credit: {
    id: "checkout_credit",
    channel: "checkout",
    label: "Checkout — Tarjeta de crédito",
    description: "Pagá con tarjeta de crédito (1 pago) desde el link de pago.",
    surchargePercent: 4.2955,
    releaseDays: "18 días",
    badge: null,
    icon: "💳",
  },
  checkout_debit: {
    id: "checkout_debit",
    channel: "checkout",
    label: "Checkout — Tarjeta de débito",
    description: "Pagá con débito desde el link de pago.",
    surchargePercent: 4.2955,
    releaseDays: "18 días",
    badge: null,
    icon: "💳",
  },
  checkout_money_in_mp: {
    id: "checkout_money_in_mp",
    channel: "checkout",
    label: "Checkout — Dinero en Mercado Pago",
    description: "Pagá con saldo de MP desde el link de pago.",
    surchargePercent: 4.2955,
    releaseDays: "18 días",
    badge: null,
    icon: "💳",
  },
  checkout_installments: {
    id: "checkout_installments",
    channel: "checkout",
    label: "Checkout — Cuotas sin tarjeta",
    description: "Pagá en cuotas sin tarjeta desde el link de pago.",
    surchargePercent: 4.2955,
    releaseDays: "18 días",
    badge: null,
    icon: "💳",
  },
  checkout_prepaid: {
    id: "checkout_prepaid",
    channel: "checkout",
    label: "Checkout — Tarjeta prepaga",
    description: "Pagá con tarjeta prepaga desde el link de pago.",
    surchargePercent: 4.2955,
    releaseDays: "18 días",
    badge: null,
    icon: "💳",
  },
  // ────── Prometeo ──────
  prometeo_transfer: {
    id: "prometeo_transfer",
    channel: "prometeo",
    label: "Transferencia bancaria tradicional",
    description: "Transferí desde tu homebanking al CBU de MayoristaMovil.",
    surchargePercent: 0.50,
    releaseDays: "Confirmación 5-15 min",
    badge: "recomendado",
    icon: "🏛️",
  },
};

// ============================================================
// FEATURE FLAGS
// ============================================================

export function getEnabledPaymentMethods(): PaymentMethod[] {
  const all: PaymentMethod[] = Object.keys(PAYMENT_METHOD_COMMISSIONS) as PaymentMethod[];

  return all.filter((m) => {
    const flag = `PAYMENT_${m.toUpperCase()}_ENABLED`;
    // Default: todos activos excepto Prometeo (que requiere Trial)
    if (m === "prometeo_transfer") return process.env[flag] === "true";
    return process.env[flag] !== "false";
  });
}

// ============================================================
// CÁLCULO DE PRECIOS — fórmula correcta
// ============================================================

/**
 * Precio final que el cliente paga, para que vos recibas el `basePrice` limpio.
 *
 * Fórmula: precio_final = precio_base / (1 - tasa_total)
 *
 * IMPORTANTE: la tasa ya incluye IVA sobre la comisión.
 */
export function calculateFinalPrice(
  basePrice: number,
  method: PaymentMethod
): number {
  const commission = PAYMENT_METHOD_COMMISSIONS[method];
  if (commission === undefined) {
    throw new Error(`Método de pago desconocido: ${method}`);
  }

  const finalPrice = basePrice / (1 - commission);
  return Math.round(finalPrice * 100) / 100;
}

export function calculateCommissionAmount(
  finalPrice: number,
  method: PaymentMethod
): number {
  const commission = PAYMENT_METHOD_COMMISSIONS[method];
  return Math.round(finalPrice * commission * 100) / 100;
}

export function calculateNetAmount(
  finalPrice: number,
  method: PaymentMethod
): number {
  return (
    Math.round(
      (finalPrice - calculateCommissionAmount(finalPrice, method)) * 100
    ) / 100
  );
}

// ============================================================
// DESGLOSE PARA UI
// ============================================================

export interface PriceBreakdown {
  method: PaymentMethod;
  meta: PaymentMethodMeta;
  basePrice: number;
  surchargeAmount: number;
  finalPrice: number;
  commissionToPlatform: number;
  netReceived: number;
}

export function getPriceBreakdown(
  basePrice: number,
  method: PaymentMethod
): PriceBreakdown {
  const finalPrice = calculateFinalPrice(basePrice, method);
  const surchargeAmount = Math.round((finalPrice - basePrice) * 100) / 100;
  const commissionToPlatform = calculateCommissionAmount(finalPrice, method);
  const netReceived = calculateNetAmount(finalPrice, method);

  return {
    method,
    meta: PAYMENT_METHODS_META[method],
    basePrice,
    surchargeAmount,
    finalPrice,
    commissionToPlatform,
    netReceived,
  };
}

export function getAllPriceBreakdowns(basePrice: number): PriceBreakdown[] {
  return getEnabledPaymentMethods().map((m) => getPriceBreakdown(basePrice, m));
}

export function getPriceBreakdownsByChannel(
  basePrice: number,
  channel: PaymentChannel
): PriceBreakdown[] {
  return getAllPriceBreakdowns(basePrice).filter(
    (b) => b.meta.channel === channel
  );
}