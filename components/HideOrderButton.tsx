
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  itemId: string;
  label?: string; // texto del botón, default "Ocultar"
}

export default function HideOrderButton({ itemId, label = "Ocultar" }: Props) {
  const router = useRouter();
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
      router.refresh();
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