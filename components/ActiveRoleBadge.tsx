"use client";

import { useEffect, useState } from "react";

export default function ActiveRoleBadge() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRole() {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;

      const data = await res.json();
      setRole(data.role);
    }

    fetchRole();
  }, []);

  if (!role) return null;

  const label =
    role === "manufacturer" ? "Fabricante" : "Revendedor";

  const color =
    role === "manufacturer"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";

  return (
    <div
      className={`px-4 py-1 rounded-full text-sm font-medium ${color}`}
    >
      Rol activo: {label}
    </div>
  );
}