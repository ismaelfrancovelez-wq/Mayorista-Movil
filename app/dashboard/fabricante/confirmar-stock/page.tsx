// app/dashboard/fabricante/confirmar-stock/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ConfirmarStockPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ✅ CORRECCIÓN: searchParams puede ser null, usamos ?. y ?? para evitarlo
  const token = searchParams?.get("token") ?? null;

  const [lotInfo, setLotInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<"confirmed" | "cancelled" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }

    async function fetchLotInfo() {
      try {
        const res = await fetch(`/api/lots/lot-by-token?token=${token}`);
        if (!res.ok) { setError("Token inválido o lote ya procesado"); return; }
        const data = await res.json();
        setLotInfo(data);
      } catch {
        setError("Error cargando información del lote");
      } finally {
        setLoading(false);
      }
    }

    fetchLotInfo();
  }, [token]);

  async function handleAction(action: "confirm" | "cancel") {
    setActing(true);
    setError("");
    try {
      const res = await fetch("/api/lots/confirm-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error procesando acción"); return; }
      setDone(action === "confirm" ? "confirmed" : "cancelled");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando información del lote...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No se pudo cargar el lote</h2>
          <p className="text-gray-500 text-sm">{error}</p>
          <button
            onClick={() => router.push("/dashboard/fabricante")}
            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Ir al dashboard
          </button>
        </div>
      </div>
    );
  }

  if (done === "confirmed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">¡Stock confirmado!</h2>
          <p className="text-gray-600 text-sm">
            Los compradores recibirán sus links de pago en los próximos minutos.
            Cuando todos paguen te avisamos por email.
          </p>
          <button
            onClick={() => router.push("/dashboard/fabricante/pedidos")}
            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Ver mis pedidos
          </button>
        </div>
      </div>
    );
  }

  if (done === "cancelled") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-700 mb-2">Lote cancelado</h2>
          <p className="text-gray-600 text-sm">
            Los compradores fueron notificados. No se realizó ningún cobro.
          </p>
          <button
            onClick={() => router.push("/dashboard/fabricante")}
            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Ir al dashboard
          </button>
        </div>
      </div>
    );
  }

  const deadline = lotInfo?.confirmationDeadlineAt
    ? new Date(lotInfo.confirmationDeadlineAt).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📦</div>
          <h1 className="text-2xl font-bold text-gray-900">Confirmación de Stock</h1>
          <p className="text-gray-500 text-sm mt-1">Un lote de tu producto está listo para despacho</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-blue-900 mb-3">Detalles del lote</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Producto:</span>
              <span className="font-semibold text-blue-900">{lotInfo?.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Cantidad total pedida:</span>
              <span className="font-semibold text-blue-900">{lotInfo?.accumulatedQty} unidades</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Compradores:</span>
              <span className="font-semibold text-blue-900">{lotInfo?.buyerCount} personas</span>
            </div>
          </div>
        </div>

        {deadline && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
            <p className="text-amber-800 text-sm font-medium">
              ⏰ Tenés hasta el <strong>{deadline}</strong> para confirmar.
              Si no respondés, el lote se cancela automáticamente.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => handleAction("confirm")}
            disabled={acting}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {acting ? "Procesando..." : "✅ Sí, tengo stock — Confirmar lote"}
          </button>
          <button
            onClick={() => handleAction("cancel")}
            disabled={acting}
            className="w-full bg-white border-2 border-red-300 text-red-600 py-3 rounded-xl font-medium hover:bg-red-50 transition disabled:opacity-50"
          >
            ❌ No tengo stock — Cancelar lote
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Si cancelás, los compradores son notificados automáticamente y no se les cobra nada.
        </p>
      </div>
    </div>
  );
}