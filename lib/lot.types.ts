/**
 * TIPOS DE LOTES - ESTANDARIZADOS
 * 
 * ✅ CAMBIOS:
 * - MF → minimumOrder
 * - Tipos normalizados de lote
 */

export interface FraccionatedOrder {
  retailerId: string;
  qty: number;
  paymentId: string;
}

export type LotType =
  | "fractional_pickup"    // Fraccionado + retiro
  | "fractional_shipping"  // Fraccionado + envío
  | "direct_pickup"        // Directo + retiro
  | "direct_shipping";     // Directo + envío

export interface Lot {
  id?: string;
  productId: string;
  factoryId: string;
  type: LotType;
  minimumOrder: number; // ✅ Antes era MF
  accumulatedQty: number;
  orders: FraccionatedOrder[];
  status: "accumulating" | "closed";
  orderCreated?: boolean;
  createdAt: any;
  updatedAt?: any;
  closedAt?: any;
}

/**
 * Helper para migrar datos legacy
 */
export function normalizeLot(data: any): Lot {
  // Normalizar type
  let type = data.type;
  if (type === "fraccionado_retiro") type = "fractional_pickup";
  if (type === "fraccionado_envio") type = "fractional_shipping";
  if (type === "directa_retiro") type = "direct_pickup";
  if (type === "directa_envio") type = "direct_shipping";

  return {
    ...data,
    type,
    minimumOrder: data.minimumOrder ?? data.MF ?? 0,
  };
}