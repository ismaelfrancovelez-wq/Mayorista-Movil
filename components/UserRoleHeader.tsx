// components/UserRoleHeader.tsx
"use client";

import { useState } from "react";

type Role = "manufacturer" | "retailer";

// ── Badge & level data (mirrors calculateScore.ts) ───────────────────────────

const STREAK_BADGES_CFG: {
  id: string; label: string; streak: number;
  color: string; bg: string; border: string;
}[] = [
  { id: "streak_start",     label: "Primer Vínculo",  streak: 1,  color: "#b45309", bg: "#fffbeb", border: "#fcd34d" },
  { id: "streak_explorer",  label: "Explorador",      streak: 3,  color: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc" },
  { id: "streak_steady",    label: "Constante",       streak: 6,  color: "#0f766e", bg: "#f0fdfa", border: "#5eead4" },
  { id: "streak_committed", label: "Comprometido",    streak: 10, color: "#4338ca", bg: "#eef2ff", border: "#a5b4fc" },
  { id: "streak_unstop",    label: "Imparable",       streak: 14, color: "#b45309", bg: "#fff7ed", border: "#fb923c" },
  { id: "streak_vip_b",     label: "VIP Bronce",      streak: 20, color: "#92400e", bg: "#fef3c7", border: "#d97706" },
  { id: "streak_vip_s",     label: "VIP Plata",       streak: 27, color: "#334155", bg: "#f8fafc", border: "#94a3b8" },
  { id: "streak_vip_g",     label: "VIP Oro",         streak: 40, color: "#854d0e", bg: "#fefce8", border: "#ca8a04" },
  { id: "streak_legend",    label: "Leyenda",          streak: 50, color: "#581c87", bg: "#faf5ff", border: "#a855f7" },
];

const MILESTONE_BADGES_CFG: {
  id: string; label: string; lots: number;
  color: string; bg: string; border: string;
}[] = [
  { id: "milestone_first",    label: "Primer Vínculo",    lots: 1,  color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  { id: "milestone_solid",    label: "Revendedor Tallado",lots: 10, color: "#1e3a5f", bg: "#eff6ff", border: "#93c5fd" },
  { id: "milestone_operator", label: "Maestro del Sector",lots: 25, color: "#78350f", bg: "#fff7ed", border: "#fb923c" },
  { id: "milestone_strategic",label: "Socio Estratégico", lots: 35, color: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
  { id: "milestone_founding", label: "Socio Fundador",    lots: 50, color: "#3b0764", bg: "#fdf4ff", border: "#c026d3" },
];

const LEVEL_CFG: Record<number, { label: string; color: string; bg: string; border: string; dot: string }> = {
  1: { label: "Nivel Verde",    color: "#166534", bg: "#f0fdf4", border: "#86efac", dot: "#22c55e" },
  2: { label: "Nivel Amarillo", color: "#854d0e", bg: "#fefce8", border: "#fde047", dot: "#eab308" },
  3: { label: "Nivel Naranja",  color: "#9a3412", bg: "#fff7ed", border: "#fb923c", dot: "#f97316" },
  4: { label: "Nivel Rojo",     color: "#991b1b", bg: "#fef2f2", border: "#fca5a5", dot: "#ef4444" },
};

interface UserRoleHeaderProps {
  userEmail?: string;
  activeRole: Role;
  userName?: string;
  milestoneBadges?: string[];
  streakBadges?: string[];
  currentStreak?: number;
  paymentLevel?: number;
  completedLots?: number;
  scoreValue?: number;
}

function IconSwitch() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}
function IconSpinner() {
  return (
    <svg style={{ animation: "urh-spin 0.8s linear infinite" }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ── Progress row ─────────────────────────────────────────────────────────────
function ProgressRow({ label, pct, current, next, urgent, barColor }: {
  label: string; pct: number; current: string; next: string; urgent: boolean; barColor: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: urgent ? "#ea580c" : "#6b7280" }}>{pct}%</span>
      </div>
      <div style={{ width: "100%", background: "#e5e7eb", borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 99,
          background: urgent ? "linear-gradient(90deg, #f97316, #ea580c)" : barColor,
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{current}</span>
        <span style={{ fontSize: 10, color: urgent ? "#ea580c" : "#9ca3af", fontWeight: urgent ? 600 : 400 }}>
          {urgent ? "¡Muy cerca! → " : "→ "}{next}
        </span>
      </div>
    </div>
  );
}

// ── Modern badge pill ─────────────────────────────────────────────────────────
function BadgePill({ label, color, bg, border, active, onClick, small }: {
  label: string; color: string; bg: string; border: string;
  active?: boolean; onClick?: () => void; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center",
        gap: small ? 4 : 5,
        fontSize: small ? 10 : 11, fontWeight: 600, color,
        background: bg, border: `1px solid ${border}`,
        borderRadius: 99, padding: small ? "2px 7px" : "3px 9px",
        cursor: onClick ? "pointer" : "default",
        letterSpacing: "0.01em", lineHeight: 1.5,
        whiteSpace: "nowrap", transition: "filter 0.12s", outline: "none",
        boxShadow: active ? `0 0 0 2px ${border}55` : "none",
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.92)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
    >
      <span style={{
        width: small ? 5 : 6, height: small ? 5 : 6, borderRadius: "50%",
        background: color, display: "inline-block", flexShrink: 0,
      }} />
      {label}
      {onClick && <IconChevronRight />}
    </button>
  );
}

// ── Progress Modal ────────────────────────────────────────────────────────────
function ProgressModal({ onClose, currentStreak, streakBadges, milestoneBadges, completedLots, paymentLevel, scoreValue }: {
  onClose: () => void;
  currentStreak: number; streakBadges: string[]; milestoneBadges: string[];
  completedLots: number; paymentLevel: number; scoreValue: number;
}) {
  const levelCfg = LEVEL_CFG[paymentLevel] ?? LEVEL_CFG[2];
  const scoreToGreenPct = paymentLevel === 1 ? 100 : Math.min(Math.round((scoreValue / 0.75) * 100), 100);

  const nextStreakBadge = STREAK_BADGES_CFG.find((b) => currentStreak < b.streak) ?? null;
  const streakPrevIdx = nextStreakBadge ? STREAK_BADGES_CFG.indexOf(nextStreakBadge) - 1 : STREAK_BADGES_CFG.length - 1;
  const streakPrev = streakPrevIdx >= 0 ? STREAK_BADGES_CFG[streakPrevIdx].streak : 0;
  const streakTarget = nextStreakBadge?.streak ?? streakPrev;
  const streakPct = nextStreakBadge
    ? Math.min(Math.round(((currentStreak - streakPrev) / (streakTarget - streakPrev)) * 100), 100)
    : 100;
  const streakUrgent = !!nextStreakBadge && (nextStreakBadge.streak - currentStreak) <= 2;

  const nextMilestone = MILESTONE_BADGES_CFG.find((b) => completedLots < b.lots) ?? null;
  const mPrevIdx = nextMilestone ? MILESTONE_BADGES_CFG.indexOf(nextMilestone) - 1 : MILESTONE_BADGES_CFG.length - 1;
  const mPrev = mPrevIdx >= 0 ? MILESTONE_BADGES_CFG[mPrevIdx].lots : 0;
  const mTarget = nextMilestone?.lots ?? mPrev;
  const milestonePct = nextMilestone
    ? Math.min(Math.round(((completedLots - mPrev) / (mTarget - mPrev)) * 100), 100)
    : 100;
  const milestoneUrgent = !!nextMilestone && (nextMilestone.lots - completedLots) <= 2;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.32)",
        zIndex: 1000, backdropFilter: "blur(3px)",
        animation: "urh-fadeIn 0.15s ease-out",
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1001, width: 340, maxWidth: "calc(100vw - 32px)",
        background: "#fff", borderRadius: 18,
        boxShadow: "0 24px 64px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)",
        padding: "20px 22px 22px",
        animation: "urh-modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Mi progreso</p>
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Reputación en Mayorista Móvil</p>
          </div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none", borderRadius: 8,
            padding: "5px 7px", cursor: "pointer", color: "#6b7280",
            display: "flex", alignItems: "center",
          }}>
            <IconX />
          </button>
        </div>

        {/* Nivel de confianza */}
        <div style={{ background: levelCfg.bg, border: `1px solid ${levelCfg.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: levelCfg.dot, flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: levelCfg.color }}>{levelCfg.label}</span>
            {paymentLevel === 1 && (
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#166534", fontWeight: 600, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 99, padding: "1px 8px" }}>
                Máximo nivel
              </span>
            )}
          </div>
          <ProgressRow
            label="Confianza de pago"
            pct={scoreToGreenPct}
            current={`Nivel actual: ${levelCfg.label}`}
            next={paymentLevel === 1 ? "¡Máximo alcanzado!" : "Nivel Verde · 9% comisión"}
            urgent={paymentLevel !== 1 && scoreToGreenPct >= 85}
            barColor="linear-gradient(90deg, #4ade80, #16a34a)"
          />
        </div>

        {/* Racha */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0369a1" }}>Racha de pagos</span>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#0369a1", background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 99, padding: "1px 8px" }}>
              {currentStreak} pts
            </span>
          </div>
          <ProgressRow
            label="Hacia próximo badge de racha"
            pct={streakPct}
            current={`${currentStreak} / ${nextStreakBadge?.streak ?? "MAX"} pts`}
            next={nextStreakBadge ? `${nextStreakBadge.label} (${nextStreakBadge.streak})` : "¡Racha máxima!"}
            urgent={streakUrgent}
            barColor="linear-gradient(90deg, #60a5fa, #2563eb)"
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {STREAK_BADGES_CFG.map((b) => {
              const earned = streakBadges.includes(b.id);
              return (
                <span key={b.id} style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                  border: `1px solid ${earned ? b.border : "#e5e7eb"}`,
                  color: earned ? b.color : "#9ca3af",
                  background: earned ? b.bg : "#f9fafb",
                }}>
                  {earned ? "" : "🔒 "}{b.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Historial permanente */}
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>Historial permanente</span>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 99, padding: "1px 8px" }}>
              {completedLots} lotes
            </span>
          </div>
          <ProgressRow
            label="Hacia próximo badge permanente"
            pct={milestonePct}
            current={`${completedLots} / ${nextMilestone?.lots ?? "MAX"} lotes`}
            next={nextMilestone ? `${nextMilestone.label} (${nextMilestone.lots})` : "¡Máximo nivel!"}
            urgent={milestoneUrgent}
            barColor="linear-gradient(90deg, #fbbf24, #d97706)"
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {MILESTONE_BADGES_CFG.map((b) => {
              const earned = milestoneBadges.includes(b.id);
              return (
                <span key={b.id} style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                  border: `1px solid ${earned ? b.border : "#e5e7eb"}`,
                  color: earned ? b.color : "#9ca3af",
                  background: earned ? b.bg : "#f9fafb",
                }}>
                  {earned ? "" : "🔒 "}{b.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function UserRoleHeader({
  userEmail,
  activeRole,
  userName,
  milestoneBadges = [],
  streakBadges = [],
  currentStreak = 0,
  paymentLevel = 2,
  completedLots = 0,
  scoreValue = 0.5,
}: UserRoleHeaderProps) {
  const [switching, setSwitching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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

  const topStreakId = streakBadges.length > 0 ? streakBadges[streakBadges.length - 1] : null;
  const topStreakCfg = topStreakId ? STREAK_BADGES_CFG.find((b) => b.id === topStreakId) ?? null : null;
  const levelCfg = LEVEL_CFG[paymentLevel] ?? LEVEL_CFG[2];

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
  const roleDotColor   = isManufacturer ? "#3b82f6" : "#8b5cf6";
  const roleTextColor  = isManufacturer ? "#1d4ed8" : "#6d28d9";
  const switchBg       = isManufacturer ? "linear-gradient(135deg, #f5f3ff, #ede9fe)" : "linear-gradient(135deg, #eff6ff, #dbeafe)";
  const switchColor    = isManufacturer ? "#6d28d9" : "#1d4ed8";

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
          padding: "10px 10px 10px 14px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
          minWidth: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: avatarGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0,
            letterSpacing: "0.05em", boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
            {initials}
          </div>

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
            <span style={{
              fontSize: 12, color: "#6b7280", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190, lineHeight: 1.3,
            }}>
              {userEmail || "Sin sesión"}
            </span>

            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600, color: roleTextColor, lineHeight: 1.3,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: roleDotColor, display: "inline-block", flexShrink: 0 }} />
              Rol activo: {currentLabel}
            </span>

            {/* Nivel + Racha + Milestones (solo retailer) */}
            {isRetailer && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                {/* Nivel */}
                <BadgePill
                  label={levelCfg.label}
                  color={levelCfg.color}
                  bg={levelCfg.bg}
                  border={levelCfg.border}
                  onClick={() => setModalOpen(true)}
                />

                {/* Racha activa */}
                {topStreakCfg && (
                  <BadgePill
                    label={`Racha · ${currentStreak} pts`}
                    color={topStreakCfg.color}
                    bg={topStreakCfg.bg}
                    border={topStreakCfg.border}
                    active
                    onClick={() => setModalOpen(true)}
                  />
                )}

                {/* Milestones obtenidos */}
                {milestoneBadges.map((id) => {
                  const cfg = MILESTONE_BADGES_CFG.find((b) => b.id === id);
                  if (!cfg) return null;
                  return (
                    <BadgePill
                      key={id}
                      label={cfg.label}
                      color={cfg.color}
                      bg={cfg.bg}
                      border={cfg.border}
                      onClick={() => setModalOpen(true)}
                      small
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 36, background: "#e5e7eb", flexShrink: 0 }} />

          {/* Switch */}
          <button
            onClick={handleSwitch}
            disabled={switching}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 10, border: "none",
              cursor: switching ? "not-allowed" : "pointer",
              background: switchBg, color: switchColor,
              fontWeight: 600, fontSize: 12, transition: "all 0.15s",
              opacity: switching ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.95)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "none"; }}
          >
            {switching ? <><IconSpinner /> Cambiando...</> : <><IconSwitch /> Cambiar a {targetLabel}</>}
          </button>
        </div>
      </div>

      {/* Modal de progreso */}
      {modalOpen && isRetailer && (
        <ProgressModal
          onClose={() => setModalOpen(false)}
          currentStreak={currentStreak}
          streakBadges={streakBadges}
          milestoneBadges={milestoneBadges}
          completedLots={completedLots}
          paymentLevel={paymentLevel}
          scoreValue={scoreValue}
        />
      )}

      <style>{`
        @keyframes urh-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes urh-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes urh-modalIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.94); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}