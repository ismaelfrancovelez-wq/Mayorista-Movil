"use client";

import { useState } from "react";
import Link from "next/link";
import { PaymentMethod } from "../../../lib/pricing/commission";

type Props = {
  reservationId: string;
  productName: string;
  qty: number;
  productSubtotal: number;
  shippingCostFinal: number;
  totalFinal: number;
  shippingMode: string;
  retailerName: string;
  paymentMethod: PaymentMethod;
  methodLabel: string;
  surchargePercent: number;
  finalPriceWithSurcharge: number;
  surchargeAmount: number;
};

export default function PagarReservaClient({
  reservationId,
  productName,
  qty,
  productSubtotal,
  shippingCostFinal,
  totalFinal,
  shippingMode,
  retailerName,
  paymentMethod,
  methodLabel,
  surchargePercent,
  finalPriceWithSurcharge,
  surchargeAmount,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPickup = shippingMode === "pickup";

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/transferencia/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error iniciando pago");
        return;
      }
      if (data.init_point) window.location.href = data.init_point;
      else if (data.redirect) window.location.href = data.redirect;
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/explorar"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4 text-sm"
        >
          ← Volver a explorar
        </Link>

        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            ¡Tu lote cerró!
          </h1>
          <p className="text-sm text-gray-600">
            Hola <strong>{retailerName}</strong>, ya podés pagar tu reserva con
            el método que elegiste.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📦 Tu pedido</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Producto:</span>
              <span className="text-gray-900 font-medium">{productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cantidad:</span>
              <span className="text-gray-900 font-medium">{qty} unidades</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-gray-900 font-medium">
                ${productSubtotal.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Envío:</span>
              <span className="text-gray-900 font-medium">
                {isPickup ? "Retiro en fábrica (gratis)" : `$${shippingCostFinal.toLocaleString("es-AR")}`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-600">Subtotal limpio:</span>
              <span className="text-gray-900 font-medium">
                ${totalFinal.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            💳 Método de pago elegido
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-blue-900">{methodLabel}</p>
            <p className="text-xs text-blue-700 mt-1">
              Recargo {surchargePercent}% — ${surchargeAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-base font-semibold text-gray-900">Total a pagar:</span>
            <span className="text-2xl font-semibold text-blue-600">
              ${finalPriceWithSurcharge.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-black text-white py-4 rounded-xl text-base font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Iniciando pago..."
            : `Pagar $${finalPriceWithSurcharge.toLocaleString("es-AR", { minimumFractionDigits: 2 })} →`}
        </button>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-300 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}