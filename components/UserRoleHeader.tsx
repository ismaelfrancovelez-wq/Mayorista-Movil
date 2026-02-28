// components/UserRoleHeader.tsx
"use client";

import { useState } from "react";

type Role = "manufacturer" | "retailer";

// ── BLOQUE 1 — Badges de racha (dinámicos, se pierden al cancelar) ────────────
// Mirrors STREAK_BADGES en calculateScore.ts
const STREAK_CONFIG: Record<string, {
  label: string;
  icon: string;
  description: string;
  gradient: string;
  textColor: string;
  accentColor: string;
}> = {
  streak_start: {
    label: "Primer Vínculo",
    icon: "🔗",
    description: "1 reserva activa",
    gradient: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
    textColor: "#14532d",
    accentColor: "#16a34a",
  },
  streak_explorer: {
    label: "Explorador",
    icon: "🧭",
    description: "3 reservas — 25% de descuento en envío",
    gradient: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
    textColor: "#065f46",
    accentColor: "#059669",
  },
  streak_steady: {
    label: "Constante",
    icon: "📌",
    description: "6 reservas — 30% de descuento en envío",
    gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
    textColor: "#1e40af",
    accentColor: "#2563eb",
  },
  streak_committed: {
    label: "Comprometido",
    icon: "💪",
    description: "10 reservas — 35% de descuento en envío",
    gradient: "linear-gradient(135deg, #fef9c3, #fef3c7)",
    textColor: "#92400e",
    accentColor: "#d97706",
  },
  streak_unstop: {
    label: "Imparable",
    icon: "⚡",
    description: "14 reservas — 40% de descuento en envío",
    gradient: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
    textColor: "#4c1d95",
    accentColor: "#7c3aed",
  },
  streak_vip_b: {
    label: "VIP Bronce",
    icon: "🥉",
    description: "20 reservas — 45% de descuento en envío",
    gradient: "linear-gradient(135deg, #fff7ed, #ffedd5)",
    textColor: "#7c2d12",
    accentColor: "#ea580c",
  },
  streak_vip_s: {
    label: "VIP Plata",
    icon: "🥈",
    description: "27 reservas — 50% de descuento en envío",
    gradient: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
    textColor: "#1e293b",
    accentColor: "#64748b",
  },
  streak_vip_g: {
    label: "VIP Oro",
    icon: "🥇",
    description: "40 reservas — 55% de descuento en envío",
    gradient: "linear-gradient(135deg, #fefce8, #fef9c3)",
    textColor: "#713f12",
    accentColor: "#ca8a04",
  },
  streak_legend: {
    label: "Leyenda",
    icon: "🌟",
    description: "50 reservas — ¡Lote completamente GRATIS!",
    gradient: "linear-gradient(135deg, #fdf4ff, #fae8ff)",
    textColor: "#581c87",
    accentColor: "#9333ea",
  },
};

// ── Badges de milestone (permanentes, nunca se pierden) ────────────────────
// Mirrors MILESTONE_BADGES en calculateScore.ts
const MILESTONE_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}> = {
  milestone_first:      { label: "Primer Vinculo",                   icon: "🥉", color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  milestone_solid:      { label: "Revendedor Tallado",               icon: "🥈", color: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
  milestone_operator:   { label: "Maestro del Sector",               icon: "🥇", color: "#78350f", bg: "#fff7ed", border: "#fb923c" },
  milestone_strategic:  { label: "Socio Estratégico",                icon: "🤝", color: "#1e40af", bg: "#dbeafe", border: "#93c5fd" }, // NUEVO
  milestone_founding:   { label: "Socio Fundador de MayoristaMovil", icon: "🏆", color: "#1e3a5f", bg: "#eff6ff", border: "#60a5fa" },
};

interface UserRoleHeaderProps {
  userEmail?: string;
  activeRole: Role;
  userName?: string;
  milestoneBadges?: string[];   // IDs permanentes
  streakBadges?: string[];      // IDs de racha activa (dinámicos)
  currentStreak?: number;       // puntos de racha actuales
}

export default function UserRoleHeader({
  userEmail,
  activeRole,
  userName,
  milestoneBadges = [],
  streakBadges = [],
  currentStreak = 0,
}: UserRoleHeaderProps) {
  const [switching, setSwitching] = useState(false);

  const isManufacturer = activeRole === "manufacturer";
  const isRetailer = activeRole === "retailer";
  const targetRole: Role = isManufacturer ? "retailer" : "manufacturer";
  const targetLabel = isManufacturer ? "Revendedor" : "Fabricante";
  const currentLabel = isManufacturer ? "Fabricante" : "Revendedor";

  const initials = userName
    ? userName.slice(0, 2).toUpperCase()
    : userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "?";

  // Badge de racha más alto activo
  const topStreakId = streakBadges.length > 0 ? streakBadges[streakBadges.length - 1] : null;
  const topStreak = topStreakId ? STREAK_CONFIG[topStreakId] : null;
  const hasActiveStreak = isRetailer && topStreak !== null && streakBadges.length > 0;

  const handleSwitch = async () => {
    setSwitching(true);
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

  const avatarGradient = isManufacturer
    ? "linear-gradient(135deg, #1d4ed8, #3b82f6)"
    : "linear-gradient(135deg, #6d28d9, #8b5cf6)";

  const roleDotColor = isManufacturer ? "#3b82f6" : "#8b5cf6";
  const roleTextColor = isManufacturer ? "#1d4ed8" : "#6d28d9";
  const switchBg = isManufacturer
    ? "linear-gradient(135deg, #f5f3ff, #ede9fe)"
    : "linear-gradient(135deg, #eff6ff, #dbeafe)";
  const switchColor = isManufacturer ? "#6d28d9" : "#1d4ed8";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>

      {/* ── MAIN CARD ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: hasActiveStreak ? "16px 16px 0 0" : "16px",
          padding: "10px 10px 10px 14px",
          boxShadow: hasActiveStreak
            ? "0 1px 8px rgba(0,0,0,0.08)"
            : "0 1px 4px rgba(0,0,0,0.06)",
          borderBottom: hasActiveStreak ? "1px solid transparent" : "1px solid #e5e7eb",
          minWidth: 0,
          position: "relative",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: avatarGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
            letterSpacing: "0.05em",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {initials}
        </div>

        {/* Info column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          {/* Email */}
          <span
            style={{
              fontSize: 12,
              color: "#6b7280",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 190,
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
              color: roleTextColor,
              lineHeight: 1.3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: roleDotColor,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Rol activo: {currentLabel}
          </span>

          {/* ── MILESTONE BADGES (permanentes) — solo el más alto ── */}
          {isRetailer && milestoneBadges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
              {(() => {
                const topMilestoneId = milestoneBadges[milestoneBadges.length - 1];
                const cfg = MILESTONE_CONFIG[topMilestoneId];
                if (!cfg) return null;
                return (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      color: cfg.color,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: 6,
                      padding: "1px 6px",
                      lineHeight: 1.6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 36, background: "#e5e7eb", flexShrink: 0 }} />

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
            background: switchBg,
            color: switchColor,
            fontWeight: 600,
            fontSize: 12,
            transition: "all 0.15s",
            opacity: switching ? 0.6 : 1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.95)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
        >
          {switching ? (
            <>
              <svg style={{ animation: "urh-spin 0.8s linear infinite" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Cambiando...
            </>
          ) : (
            <>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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

      {/* ── STREAK PANEL — visible cuando hay racha activa ── */}
      {hasActiveStreak && topStreak && (
        <div
          style={{
            width: "100%",
            background: topStreak.gradient,
            border: `1px solid ${topStreak.accentColor}40`,
            borderTop: `1px solid ${topStreak.accentColor}30`,
            borderRadius: "0 0 14px 14px",
            padding: "8px 14px 10px",
            boxShadow: `0 4px 12px ${topStreak.accentColor}20`,
            animation: "urh-slideDown 0.3s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {/* Left: icon + label + description */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 20,
                  lineHeight: 1,
                  flexShrink: 0,
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
                }}
              >
                {topStreak.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: topStreak.textColor,
                    letterSpacing: "0.02em",
                    lineHeight: 1.3,
                  }}
                >
                  {topStreak.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: topStreak.accentColor,
                    lineHeight: 1.4,
                    marginTop: 1,
                  }}
                >
                  {topStreak.description}
                </p>
              </div>
            </div>

            {/* Right: streak counter pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: `${topStreak.accentColor}18`,
                border: `1px solid ${topStreak.accentColor}40`,
                borderRadius: 20,
                padding: "3px 10px",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: topStreak.accentColor }}>
                {currentStreak}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: topStreak.textColor, opacity: 0.7, lineHeight: 1.2 }}>
                pts racha
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes urh-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes urh-slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}