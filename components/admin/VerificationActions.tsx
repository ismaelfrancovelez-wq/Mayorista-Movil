// components/admin/VerificationActions.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  verificationId: string;
  manufacturerId: string;
  legalName: string;
};

export default function VerificationActions({
  verificationId,
  manufacturerId,
  legalName,
}: Props) {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  /* ===============================
     ✅ APROBAR VERIFICACIÓN
  =============================== */
  async function handleApprove() {
    if (!confirm(`¿Aprobar la verificación de "${legalName}"?`)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/verification/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId,
          manufacturerId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al aprobar");
      }

      alert("✅ Verificación aprobada correctamente");
      router.push("/admin/verificaciones");
      router.refresh();
      
    } catch (err: any) {
      setError(err.message || "Error al aprobar verificación");
    } finally {
      setLoading(false);
    }
  }

  /* ===============================
     ❌ RECHAZAR VERIFICACIÓN
  =============================== */
  async function handleReject() {
    if (!rejectionReason.trim()) {
      setError("Debes escribir un motivo de rechazo");
      return;
    }

    if (!confirm(`¿Rechazar la verificación de "${legalName}"?`)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/verification/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId,
          manufacturerId,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al rechazar");
      }

      alert("✅ Verificación rechazada correctamente");
      router.push("/admin/verificaciones");
      router.refresh();
      
    } catch (err: any) {
      setError(err.message || "Error al rechazar verificación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold mb-6">⚡ Acciones de Verificación</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
          ❌ {error}
        </div>
      )}

      {/* BOTONES PRINCIPALES */}
      {!showRejectForm && (
        <div className="grid md:grid-cols-2 gap-4">
          
          {/* APROBAR */}
          <button
            onClick={handleApprove}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              "Procesando..."
            ) : (
              <>
                <span>✓</span>
                <span>Aprobar Verificación</span>
              </>
            )}
          </button>

          {/* RECHAZAR */}
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
            className="border-2 border-red-500 text-red-600 px-6 py-3 rounded-xl font-semibold hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>✕</span>
            <span>Rechazar Verificación</span>
          </button>
        </div>
      )}

      {/* FORMULARIO DE RECHAZO */}
      {showRejectForm && (
        <div className="border-2 border-red-200 rounded-xl p-6 bg-red-50">
          <h3 className="font-bold text-red-900 mb-4">
            Motivo del Rechazo
          </h3>

          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full border-2 border-red-300 rounded-lg px-4 py-3 focus:border-red-500 focus:outline-none mb-4"
            rows={4}
            placeholder="Ej: El documento de AFIP no coincide con el CUIT ingresado..."
          />

          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={loading || !rejectionReason.trim()}
              className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando..." : "Confirmar Rechazo"}
            </button>

            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectionReason("");
                setError("");
              }}
              disabled={loading}
              className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* INFORMACIÓN */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>ℹ️ Recordá:</strong>
        </p>
        <ul className="text-sm text-gray-600 mt-2 space-y-1">
          <li>• Al aprobar, el fabricante recibirá el badge de verificación</li>
          <li>• Al rechazar, el fabricante podrá corregir y volver a enviar</li>
          <li>• Verificá que toda la documentación sea correcta antes de aprobar</li>
        </ul>
      </div>
    </div>
  );
}