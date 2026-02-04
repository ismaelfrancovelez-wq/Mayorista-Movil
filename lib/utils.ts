import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

/* ===============================
   ✅ FIX ERROR 21: Helper de formateo de moneda
   Uso consistente en toda la aplicación
=============================== */

/**
 * Formatea un monto en pesos argentinos sin decimales
 * @param amount - Monto a formatear
 * @returns String formateado (ej: "$ 1.500")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea un monto en pesos argentinos con 2 decimales
 * @param amount - Monto a formatear
 * @returns String formateado (ej: "$ 1.500,50")
 */
export function formatCurrencyWithDecimals(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}