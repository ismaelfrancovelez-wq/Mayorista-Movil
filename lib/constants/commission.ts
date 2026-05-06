// lib/constants/commission.ts
//
// MIGRACIÓN: el sistema viejo aplicaba 4% MP fijo + 9-16% por nivel del retailer.
// Eso fue ELIMINADO. El cliente ahora paga el recargo real del método de pago
// que elija (ver lib/pricing/commission.ts), y vos recibís el precio base limpio.
//
// Este archivo se mantiene como SHIM por compatibilidad: muchos archivos
// importan getDisplayPrice() y sería más invasivo borrarlos uno por uno.
// Acá ahora getDisplayPrice() devuelve el precio base sin modificar.
//
// TODO: deprecar este archivo en una segunda pasada de cleanup.

/**
 * @deprecated El sistema de comisión transaccional fue eliminado.
 * Ahora el cliente paga el recargo del método de pago elegido.
 * Esta constante existe solo para no romper imports legacy. Vale 0.
 */
export const MP_COMMISSION_RATE = 0;

/**
 * @deprecated Ahora el factor es 1 (sin recargo).
 */
export const MP_COMMISSION_FACTOR = 1;

/**
 * Devuelve el precio que se le muestra al comprador.
 *
 * ANTES: priceBase × 1.04 (incluía 4% MP)
 * AHORA: priceBase (limpio, sin recargo)
 *
 * El recargo por método de pago se calcula al momento de pagar
 * usando lib/pricing/commission.ts, no acá.
 */
export function getDisplayPrice(priceBase: number): number {
  return Math.round(priceBase);
}