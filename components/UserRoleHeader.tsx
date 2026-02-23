// components/UserRoleHeader.tsx
// Reemplaza los bloques de ActiveRoleBadge + SwitchRoleButton en ambos dashboards

"use client";

import { useEffect, useState } from "react";

type Role = "manufacturer" | "retailer";

interface UserRoleHeaderProps {
  userEmail?: string;       // pasar desde el servidor via prop
  activeRole: Role;
  userName?: string;
}

export default function UserRoleHeader({
  userEmail,
  activeRole,
  userName,
}: UserRoleHeaderProps) {
  const [switching, setSwitching] = useState(false);

  const isManufacturer = activeRole === "manufacturer";
  const targetRole: Role = isManufacturer ? "retailer" : "manufacturer";
  const targetLabel = isManufacturer ? "Revendedor" : "Fabricante";
  const currentLabel = isManufacturer ? "Fabricante" : "Revendedor";

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "?";

  const handleSwitch = async () => {
    setSwitching(true);
    // Llama a tu endpoint existente para cambiar de rol
    await fetch("/api/auth/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: targetRole }),
    });
    window.location.href =
      targetRole === "manufacturer"
        ? "/dashboard/fabricante"
        : "/dashboard/pedidos-fraccionados";
  };

  return (
    <div className="flex items-center gap-3">
      {/* Pill contenedor */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "8px 8px 8px 16px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 0px #3b82f6",
          transition: "box-shadow 0.2s",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: isManufacturer
              ? "linear-gradient(135deg, #1d4ed8, #3b82f6)"
              : "linear-gradient(135deg, #6d28d9, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
            letterSpacing: "0.05em",
          }}
        >
          {initials}
        </div>

        {/* Info columna */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          {/* Email */}
          <span
            style={{
              fontSize: 12,
              color: "#6b7280",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 180,
              lineHeight: 1.3,
            }}
          >
            {userEmail || "Sin sesión"}
          </span>

          {/* Role badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: isManufacturer ? "#1d4ed8" : "#6d28d9",
              lineHeight: 1.3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isManufacturer ? "#3b82f6" : "#8b5cf6",
                display: "inline-block",
              }}
            />
            Rol activo: {currentLabel}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 32,
            background: "#e5e7eb",
            flexShrink: 0,
          }}
        />

        {/* Switch button */}
        <button
          onClick={handleSwitch}
          disabled={switching}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 10,
            border: "none",
            cursor: switching ? "not-allowed" : "pointer",
            background: isManufacturer
              ? "linear-gradient(135deg, #f5f3ff, #ede9fe)"
              : "linear-gradient(135deg, #eff6ff, #dbeafe)",
            color: isManufacturer ? "#6d28d9" : "#1d4ed8",
            fontWeight: 600,
            fontSize: 12,
            transition: "all 0.15s",
            opacity: switching ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.filter =
              "brightness(0.95)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.filter = "none";
          }}
        >
          {switching ? (
            <>
              <svg
                style={{ animation: "spin 0.8s linear infinite" }}
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Cambiando...
            </>
          ) : (
            <>
              <svg
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
              Cambiar a {targetLabel}
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}