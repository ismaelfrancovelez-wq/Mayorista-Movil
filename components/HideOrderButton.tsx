"use client";
// app/components/HideOrderButton.tsx
//
// Botón pequeño para ocultar un pedido de la lista del usuario.
// NO borra datos — solo los esconde visualmente.
// El dato queda en Firestore para historial y auditoría.

import { useState } from "react";

interface Props {
  itemId: string;
  label?: string; // texto del botón, default "Ocultar"
}

export default function HideOrderButton({ itemId, label = "Ocultar" }: Props) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleHide() {
    setLoading(true);
    try {
      await fetch("/api/orders/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      // Recargar la página para reflejar el cambio
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  if (showConfirm) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-gray-500">¿Ocultar?</span>
        <button
          onClick={handleHide}
          disabled={loading}
          className="text-xs text-red-500 hover:text-red-700 font-medium transition"
        >
          {loading ? "..." : "Sí"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      title="Ocultar este pedido de tu lista"
      className="text-xs text-gray-400 hover:text-gray-600 underline transition"
    >
      {label}
    </button>
  );
}