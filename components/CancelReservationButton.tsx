"use client";
// app/components/CancelReservationButton.tsx
//
// Botón "Dar de baja" para reservas en estado pending_lot.
// Llama a /api/reservations/cancel y recarga la página al confirmar.

import { useState } from "react";

interface Props {
  reservationId: string;
  productName: string;
}

export default function CancelReservationButton({ reservationId, productName }: Props) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al cancelar. Intentá de nuevo.");
        setLoading(false);
        return;
      }

      // Recargar la página para reflejar el cambio
      window.location.reload();
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
      setLoading(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800 font-medium mb-1">
          ¿Dar de baja la reserva de <strong>{productName}</strong>?
        </p>
        <p className="text-xs text-red-600 mb-3">
          Esta acción no se puede deshacer. Tu lugar en el lote se liberará.
        </p>
        {error && (
          <p className="text-xs text-red-700 bg-red-100 rounded p-2 mb-3">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-semibold rounded transition"
          >
            {loading ? "Cancelando..." : "Sí, dar de baja"}
          </button>
          <button
            onClick={() => { setShowConfirm(false); setError(null); }}
            disabled={loading}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded transition"
          >
            No, mantener
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="mt-3 text-xs text-red-500 hover:text-red-700 underline transition"
    >
      Dar de baja esta reserva
    </button>
  );
}