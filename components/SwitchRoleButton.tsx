"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export default function SwitchRoleButton({
  targetRole,
}: {
  targetRole: "manufacturer" | "retailer";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function switchRole() {
    setLoading(true);

    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole }),
      });

      if (!res.ok) {
        throw new Error("Error al cambiar rol");
      }

      toast.success(
        `Rol cambiado a ${
          targetRole === "manufacturer"
            ? "Fabricante"
            : "Revendedor"
        }`
      );

      // 🔥 ESTA ES LA LÍNEA CLAVE
      router.refresh();

      router.push(
        targetRole === "manufacturer"
          ? "/dashboard/fabricante"
          : "/dashboard/pedidos-fraccionados"
      );
    } catch (error) {
  console.error("Error cambio rol:", error);
  toast.error("No se pudo cambiar el rol");
} finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={switchRole}
      disabled={loading}
      className="px-4 py-2 border rounded-md text-sm hover:bg-gray-100 disabled:opacity-50"
    >
      {loading
        ? "Cambiando rol..."
        : `Cambiar a ${
            targetRole === "manufacturer"
              ? "Fabricante"
              : "Revendedor"
          }`}
    </button>
  );
}