"use client";

import { useState } from "react";

type PedidoFraccionadoCardProps = {
  paymentId: string;
  productName: string;
  qty: number;
  MF: number;
  accumulatedQty: number;
  status: "accumulating" | "closed";
  createdAt: string;
  refundable: boolean;
};

export default function PedidoFraccionadoCard({
  paymentId,
  productName,
  qty,
  MF,
  accumulatedQty,
  status,
  createdAt,
  refundable,
}: PedidoFraccionadoCardProps) {
  const [loading, setLoading] = useState(false);
  const [refunded, setRefunded] = useState(false);

  async function handleRefund() {
    if (!confirm("¿Seguro que querés cancelar y reembolsar este pedido?")) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Error al reembolsar");
        return;
      }

      setRefunded(true);
    } catch (err) {
  console.error("Error reembolso:", err);
  alert("Error inesperado");
} finally {
      setLoading(false);
    }
  }

  const progress = Math.min(
    Math.round((accumulatedQty / MF) * 100),
    100
  );

  return (
    <div className="border rounded-lg p-4 mb-4 bg-white shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{productName}</h3>
          <p className="text-sm text-gray-500">
            Pedido realizado: {createdAt}
          </p>
        </div>

        <span
          className={`text-xs px-2 py-1 rounded ${
            status === "closed"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {status === "closed" ? "Lote cerrado" : "En acumulación"}
        </span>
      </div>

      {/* PROGRESO */}
<div className="mt-4">
  <div className="flex justify-between text-sm mb-1">
    <span>
      Progreso del lote: {accumulatedQty}/{MF}
    </span>
    <span>{progress}%</span>
  </div>

  <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
    <div
      className="bg-black h-2 transition-all"
      style={{ width: progress + "%" }}
    />
  </div>
</div>

      {/* INFO PEDIDO */}
      <div className="mt-3 text-sm">
        <p>
          <strong>Tu cantidad:</strong> {qty}
        </p>
      </div>

      {/* REEMBOLSO */}
      {refundable && status === "accumulating" && !refunded && (
        <button
          onClick={handleRefund}
          disabled={loading}
          className="mt-4 w-full border border-red-500 text-red-600 py-2 rounded hover:bg-red-50 disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Cancelar y pedir reembolso"}
        </button>
      )}

      {refunded && (
        <p className="mt-4 text-sm text-red-600">
          Pedido reembolsado correctamente
        </p>
      )}

      {status === "closed" && (
        <p className="mt-4 text-sm text-green-700">
          El lote ya se cerró. No se puede reembolsar.
        </p>
      )}
    </div>
  );
}