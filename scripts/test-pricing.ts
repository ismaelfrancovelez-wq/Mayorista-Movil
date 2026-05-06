// scripts/test-pricing.ts
import {
  getPriceBreakdown,
  PAYMENT_METHOD_COMMISSIONS,
  PAYMENT_METHODS_META,
  type PaymentMethod,
} from "../lib/pricing/commission";

console.log("\n=== TEST DE COMISIONES ===\n");
console.log("Sobre precio base $100.000 (para cuadrar contra el cuadro de MP)\n");

const methods = Object.keys(PAYMENT_METHOD_COMMISSIONS) as PaymentMethod[];
const basePrice = 100000;

methods.forEach((m) => {
  const b = getPriceBreakdown(basePrice, m);
  const ok = Math.abs(b.netReceived - basePrice) < 0.01;
  console.log(
    `${b.meta.label.padEnd(50)} | ` +
    `Pcte paga $${b.finalPrice.toLocaleString("es-AR", {minimumFractionDigits: 2})} | ` +
    `Recargo $${b.surchargeAmount.toLocaleString("es-AR", {minimumFractionDigits: 2})} | ` +
    `Recibís $${b.netReceived.toLocaleString("es-AR", {minimumFractionDigits: 2})} ${ok ? "✅" : "❌"}`
  );
});

console.log("\n=== VERIFICACIÓN CONTRA CUADRO MP ===\n");
console.log("(comparar 'Descuento sobre $100.000' del panel MP con la columna 'Recargo')\n");
console.log("Esperado QR Dinero MP:        $968,00");
console.log("Esperado QR Débito:           $1.076,90");
console.log("Esperado QR Cuotas:           $1.706,10");
console.log("Esperado QR Crédito:          $5.566,00");
console.log("Esperado Checkout (todos):    $4.295,50");
console.log("Esperado Prometeo (0,50%):    $500,00");