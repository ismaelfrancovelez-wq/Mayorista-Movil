// components/UserRoleHeader.tsx
// Diseño B2B Profesional — Sistema de "Credenciales Comerciales"
// Hexágonos limpios, sin llamas, colores de negocio
"use client";

import { useState } from "react";

// ✅ ACTUALIZADO: ahora acepta los 4 roles
type Role = "manufacturer" | "retailer" | "distributor" | "wholesaler";

// ─── DESCUENTOS POR RACHA ─────────────────────────────────────────────────────
const STREAK_DISCOUNTS: Record<number, { shipping: number; commission: number; label: string }> = {
  1:  { shipping: 0.10, commission: 0,    label: "10% desc. envío"      },
  3:  { shipping: 0.25, commission: 0,    label: "25% desc. envío"      },
  6:  { shipping: 0.30, commission: 0,    label: "30% desc. envío"      },
  10: { shipping: 0.35, commission: 0,    label: "35% desc. envío"      },
  14: { shipping: 0.40, commission: 0,    label: "40% desc. envío"      },
  20: { shipping: 0.45, commission: 0,    label: "45% desc. envío"      },
  27: { shipping: 0.50, commission: 0,    label: "50% desc. envío"      },
  40: { shipping: 0.55, commission: 0,    label: "55% desc. envío"      },
  50: { shipping: 1.00, commission: 1.00, label: "🎁 Lote 100% gratis" },
};

// ─── BADGE DATA ────────────────────────────────────────────────────────────────
const STREAK_BADGES_DATA: { id: string; label: string; streak: number; tier: number }[] = [
  { id: "streak_start",     label: "Primer Vínculo", streak: 1,  tier: 1 },
  { id: "streak_explorer",  label: "Explorador",     streak: 3,  tier: 1 },
  { id: "streak_steady",    label: "Constante",      streak: 6,  tier: 2 },
  { id: "streak_committed", label: "Comprometido",   streak: 10, tier: 2 },
  { id: "streak_unstop",    label: "Imparable",      streak: 14, tier: 3 },
  { id: "streak_vip_b",     label: "VIP Bronce",     streak: 20, tier: 3 },
  { id: "streak_vip_s",     label: "VIP Plata",      streak: 27, tier: 4 },
  { id: "streak_vip_g",     label: "VIP Oro",        streak: 40, tier: 4 },
  { id: "streak_legend",    label: "Leyenda",        streak: 50, tier: 5 },
];

const MILESTONE_BADGES_DATA: { id: string; label: string; lots: number; tier: number }[] = [
  { id: "milestone_first",     label: "Primer Vínculo",    lots: 1,  tier: 1 },
  { id: "milestone_solid",     label: "Revendedor Tallado", lots: 10, tier: 2 },
  { id: "milestone_operator",  label: "Maestro del Sector", lots: 25, tier: 3 },
  { id: "milestone_strategic", label: "Socio Estratégico",  lots: 35, tier: 4 },
  { id: "milestone_founding",  label: "Socio Fundador",     lots: 50, tier: 5 },
];

// LEVEL_DATA actualizado para el nuevo sistema de colores B2B
const LEVEL_DATA = [
  { level: 1, label: "Nivel 1", bg: "#082030", text: "#50e8f8", border: "#20b8d0", tier: 5, desc: "9% comisión",  icon: "star"   as const },
  { level: 2, label: "Nivel 2", bg: "#2a1e08", text: "#f0c050", border: "#c09030", tier: 3, desc: "12% comisión", icon: "bolt"   as const },
  { level: 3, label: "Nivel 3", bg: "#0e2e1a", text: "#70d888", border: "#40b060", tier: 2, desc: "14% comisión", icon: "bolt"   as const },
  { level: 4, label: "Nivel 4", bg: "#0e2040", text: "#80b8f0", border: "#4090d8", tier: 1, desc: "16% comisión", icon: "shield" as const },
];

// ─── TEMA COMERCIAL B2B ───────────────────────────────────────────────────────
const COMMERCIAL_TIER: Record<number, {
  bg1: string; bg2: string;
  border: string; borderInner: string;
  iconColor: string; accent: string;
  glow: string | null; labelColor: string;
}> = {
  0: {
    bg1:"#1c1f2e", bg2:"#13151f",
    border:"#2a2d40", borderInner:"#252838",
    iconColor:"#50537a", accent:"#50537a",
    glow: null, labelColor:"#606080",
  },
  1: {
    bg1:"#0e2040", bg2:"#091528",
    border:"#1e4888", borderInner:"#2a60a8",
    iconColor:"#60a8e8", accent:"#4090d8",
    glow:"0 0 16px rgba(64,144,216,0.35)", labelColor:"#80b8f0",
  },
  2: {
    bg1:"#0e2e1a", bg2:"#091e10",
    border:"#1a6035", borderInner:"#259048",
    iconColor:"#50c870", accent:"#40b060",
    glow:"0 0 16px rgba(64,176,96,0.35)", labelColor:"#70d888",
  },
  3: {
    bg1:"#2e1e08", bg2:"#1e1205",
    border:"#886020", borderInner:"#b08030",
    iconColor:"#e8b040", accent:"#d0a030",
    glow:"0 0 20px rgba(208,160,48,0.4)", labelColor:"#f0c050",
  },
  4: {
    bg1:"#1e1035", bg2:"#130a22",
    border:"#5028a8", borderInner:"#7040d0",
    iconColor:"#a870f8", accent:"#9060e8",
    glow:"0 0 22px rgba(144,96,232,0.45)", labelColor:"#c090ff",
  },
  5: {
    bg1:"#082030", bg2:"#041518",
    border:"#1880a0", borderInner:"#20b8d0",
    iconColor:"#50e8f8", accent:"#30d0e8",
    glow:"0 0 26px rgba(48,208,232,0.5)", labelColor:"#80f0ff",
  },
};

// ─── BADGE HEXAGONAL PROFESIONAL ─────────────────────────────────────────────
type IconType = "bolt" | "star" | "shield";

function CommercialBadge({
  tier = 0, locked = false, size = 64, icon = "bolt" as IconType, animPulse = false,
}: {
  tier?: number; locked?: boolean; size?: number; icon?: IconType; animPulse?: boolean;
}) {
  const s = size, c = s / 2;
  const th = locked ? COMMERCIAL_TIER[0] : (COMMERCIAL_TIER[tier] || COMMERCIAL_TIER[1]);

  const R  = s * 0.44;
  const Ri = s * 0.31;

  const hexPts = (r: number) =>
    [0, 60, 120, 180, 240, 300]
      .map(d => {
        const a = d * Math.PI / 180;
        return `${c + r * Math.sin(a)},${c - r * Math.cos(a)}`;
      })
      .join(" ");

  const bgId    = `cb-bg-${tier}-${s}`;
  const glowId  = `cb-gw-${tier}-${s}`;
  const sheenId = `cb-sh-${tier}-${s}`;

  return (
    <svg
      width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      style={{
        filter: !locked && th.glow
          ? `drop-shadow(${th.glow})`
          : "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
        animation: animPulse && !locked ? "urh-badge-breathe 2.8s ease-in-out infinite" : undefined,
        flexShrink: 0, overflow: "visible",
      }}
    >
      <defs>
        <linearGradient id={bgId} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%"   stopColor={th.bg1} />
          <stop offset="100%" stopColor={th.bg2} />
        </linearGradient>
        {!locked && (
          <radialGradient id={glowId} cx="50%" cy="38%" r="62%">
            <stop offset="0%"   stopColor={th.accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={th.accent} stopOpacity="0"    />
          </radialGradient>
        )}
        <linearGradient id={sheenId} x1="0.2" y1="0" x2="0.8" y2="0.8">
          <stop offset="0%"  stopColor="white" stopOpacity="0.14" />
          <stop offset="55%" stopColor="white" stopOpacity="0"    />
        </linearGradient>
      </defs>

      <polygon
        points={hexPts(R)}
        fill={`url(#${bgId})`}
        stroke={th.border}
        strokeWidth={s * 0.038}
        strokeLinejoin="round"
      />

      {!locked && <polygon points={hexPts(R)} fill={`url(#${glowId})`} />}

      <polygon
        points={hexPts(Ri)}
        fill="none"
        stroke={th.borderInner}
        strokeWidth={s * 0.018}
        strokeLinejoin="round"
        opacity={locked ? 0.25 : 0.5}
      />

      {locked ? (
        <g opacity={0.38}>
          <rect x={c-s*0.09} y={c+s*0.01} width={s*0.18} height={s*0.13} rx={s*0.022} fill={th.iconColor}/>
          <path
            d={`M ${c-s*0.055} ${c+s*0.01} v-${s*0.06} a${s*0.055} ${s*0.055} 0 0 1 ${s*0.11} 0 v${s*0.06}`}
            fill="none" stroke={th.iconColor} strokeWidth={s*0.038} strokeLinecap="round"
          />
        </g>
      ) : (
        <BusinessIcon cx={c} cy={c} s={s * 0.32} color={th.iconColor} type={icon} />
      )}

      <polygon points={hexPts(R)} fill={`url(#${sheenId})`} />
    </svg>
  );
}

// ─── ÍCONOS DE NEGOCIO ────────────────────────────────────────────────────────
function BusinessIcon({
  cx, cy, s, color, type,
}: { cx: number; cy: number; s: number; color: string; type: IconType }) {
  const h = s / 2;

  if (type === "bolt") {
    return (
      <polygon
        points={[
          `${cx + h*0.24},${cy - h*0.88}`,
          `${cx - h*0.16},${cy + h*0.10}`,
          `${cx + h*0.10},${cy + h*0.10}`,
          `${cx - h*0.24},${cy + h*0.88}`,
          `${cx + h*0.16},${cy - h*0.10}`,
          `${cx - h*0.10},${cy - h*0.10}`,
        ].join(" ")}
        fill={color}
      />
    );
  }

  if (type === "star") {
    const pts = Array.from({ length: 5 }, (_, i) => {
      const ao = (i * 72 - 90) * Math.PI / 180;
      const ai = (i * 72 - 54) * Math.PI / 180;
      return `${cx + Math.cos(ao)*h*0.92},${cy + Math.sin(ao)*h*0.92} ${cx + Math.cos(ai)*h*0.40},${cy + Math.sin(ai)*h*0.40}`;
    }).join(" ");
    return <polygon points={pts} fill={color} />;
  }

  return (
    <path
      d={`M ${cx} ${cy-h*0.88} L ${cx+h*0.68} ${cy-h*0.42} L ${cx+h*0.68} ${cy+h*0.18} Q ${cx+h*0.68} ${cy+h*0.88} ${cx} ${cy+h*0.92} Q ${cx-h*0.68} ${cy+h*0.88} ${cx-h*0.68} ${cy+h*0.18} L ${cx-h*0.68} ${cy-h*0.42} Z`}
      fill={color}
    />
  );
}

// ─── BARRA DE PROGRESO: RACHA DE LOTES ───────────────────────────────────────
function StreakTimelineBar({
  badges, currentValue, maxValue, color,
}: {
  badges: typeof STREAK_BADGES_DATA;
  currentValue: number;
  maxValue: number;
  color: string;
}) {
  const pct = Math.min((currentValue / maxValue) * 100, 100);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", padding: "0 8px", marginBottom: 20 }}>
        <div style={{ position: "relative", height: 22, marginBottom: 8 }}>
          {badges.map(b => {
            const pos = (b.streak / maxValue) * 100;
            const earned = currentValue >= b.streak;
            return (
              <div key={b.id} style={{
                position: "absolute", left: `${pos}%`,
                transform: "translateX(-50%)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 900,
                  color: earned ? color : "#404060",
                  textShadow: earned ? `0 0 10px ${color}88` : "none",
                  lineHeight: 1,
                }}>
                  {b.streak}
                </span>
                <div style={{
                  width: 1.5, height: 5,
                  background: earned ? color : "#252540",
                  opacity: earned ? 0.8 : 0.35,
                }} />
              </div>
            );
          })}
        </div>

        <div style={{ position: "relative", height: 14 }}>
          <div style={{
            position: "absolute", left: 0, right: 0,
            top: "50%", transform: "translateY(-50%)",
            height: 9, background: "#141420", borderRadius: 99,
            border: "1px solid #252538",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8)",
          }} />
          {pct > 0 && (
            <div style={{
              position: "absolute", left: 0, top: "50%",
              transform: "translateY(-50%)",
              width: `${pct}%`, height: 9, borderRadius: 99,
              background: `linear-gradient(90deg, ${color}55, ${color}cc, ${color})`,
              boxShadow: `0 0 12px ${color}88, 0 0 24px ${color}44`,
              transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
            }} />
          )}
          {badges.map(b => {
            const pos = (b.streak / maxValue) * 100;
            const earned = currentValue >= b.streak;
            return (
              <div key={b.id} style={{
                position: "absolute", left: `${pos}%`, top: "50%",
                transform: "translate(-50%,-50%)",
                width: 2, height: 18,
                background: earned ? color : "#2a2a40",
                opacity: earned ? 0.65 : 0.3,
                zIndex: 2, borderRadius: 1,
              }} />
            );
          })}
          {pct > 1 && pct < 99 && (
            <div style={{
              position: "absolute", top: "50%", left: `${pct}%`,
              transform: "translate(-50%,-50%)",
              width: 16, height: 16, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, #fff, ${color})`,
              boxShadow: `0 0 10px ${color}, 0 0 24px ${color}88`,
              zIndex: 3,
              animation: "urh-head-pulse 1.4s ease-in-out infinite",
            }} />
          )}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
      }}>
        {badges.map(b => {
          const earned = currentValue >= b.streak;
          const th = COMMERCIAL_TIER[earned ? b.tier : 0];
          const discount = STREAK_DISCOUNTS[b.streak];
          const isLegend = b.streak === 50;

          return (
            <div key={b.id} style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: earned
                ? `linear-gradient(135deg, ${th.bg1}ee, ${th.bg2}bb)`
                : "rgba(255,255,255,0.025)",
              border: `1px solid ${earned ? th.border + "88" : "#1e1e2e"}`,
              boxShadow: earned && th.glow ? `0 0 12px ${th.accent}18` : "none",
              transition: "all 0.2s",
              position: "relative",
              overflow: "hidden",
            }}>
              {earned && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(ellipse at 15% 50%, ${th.accent}14, transparent 60%)`,
                  pointerEvents: "none",
                }} />
              )}
              <div style={{ flexShrink: 0 }}>
                <CommercialBadge tier={earned ? b.tier : 0} locked={!earned} size={44} icon="bolt" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 900,
                  color: earned ? "#ffffff" : "#a0a0c0",
                  letterSpacing: "0.04em", lineHeight: 1,
                  textShadow: earned ? `0 0 8px ${th.accent}66` : "none",
                }}>
                  {b.streak} pts
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: earned ? "#ffffff" : "#d0d0e8",
                  lineHeight: 1.2, wordBreak: "break-word",
                }}>
                  {b.label}
                </span>
                {discount && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, lineHeight: 1, marginTop: 1,
                    color: earned
                      ? (isLegend ? "#ffd700" : "#ffffff")
                      : "#606080",
                  }}>
                    {discount.label}
                  </span>
                )}
              </div>
              {earned && (
                <div style={{
                  position: "absolute", top: 6, right: 7,
                  width: 14, height: 14, borderRadius: "50%",
                  background: th.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 7px ${th.accent}88`,
                  flexShrink: 0,
                }}>
                  <svg width={8} height={8} viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#050510" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── BARRA DE PROGRESO: LOGROS PERMANENTES ────────────────────────────────────
function MilestoneTimelineBar({
  badges, currentValue, maxValue, color,
}: {
  badges: typeof MILESTONE_BADGES_DATA;
  currentValue: number;
  maxValue: number;
  color: string;
}) {
  const pct = Math.min((currentValue / maxValue) * 100, 100);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", padding: "0 8px", marginBottom: 20 }}>
        <div style={{ position: "relative", height: 22, marginBottom: 8 }}>
          {badges.map(b => {
            const pos = (b.lots / maxValue) * 100;
            const earned = currentValue >= b.lots;
            return (
              <div key={b.id} style={{
                position: "absolute", left: `${pos}%`,
                transform: "translateX(-50%)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 900,
                  color: earned ? color : "#404060",
                  textShadow: earned ? `0 0 10px ${color}88` : "none",
                  lineHeight: 1,
                }}>
                  {b.lots}
                </span>
                <div style={{ width: 1.5, height: 5, background: earned ? color : "#252540", opacity: earned ? 0.8 : 0.35 }} />
              </div>
            );
          })}
        </div>

        <div style={{ position: "relative", height: 14 }}>
          <div style={{
            position: "absolute", left: 0, right: 0,
            top: "50%", transform: "translateY(-50%)",
            height: 9, background: "#141420", borderRadius: 99,
            border: "1px solid #252538",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8)",
          }} />
          {pct > 0 && (
            <div style={{
              position: "absolute", left: 0, top: "50%",
              transform: "translateY(-50%)",
              width: `${pct}%`, height: 9, borderRadius: 99,
              background: `linear-gradient(90deg, ${color}55, ${color}cc, ${color})`,
              boxShadow: `0 0 12px ${color}88, 0 0 24px ${color}44`,
              transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
            }} />
          )}
          {badges.map(b => {
            const pos = (b.lots / maxValue) * 100;
            const earned = currentValue >= b.lots;
            return (
              <div key={b.id} style={{
                position: "absolute", left: `${pos}%`, top: "50%",
                transform: "translate(-50%,-50%)",
                width: 2, height: 18,
                background: earned ? color : "#2a2a40",
                opacity: earned ? 0.65 : 0.3,
                zIndex: 2, borderRadius: 1,
              }} />
            );
          })}
          {pct > 1 && pct < 99 && (
            <div style={{
              position: "absolute", top: "50%", left: `${pct}%`,
              transform: "translate(-50%,-50%)",
              width: 16, height: 16, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, #fff, ${color})`,
              boxShadow: `0 0 10px ${color}, 0 0 24px ${color}88`,
              zIndex: 3,
              animation: "urh-head-pulse 1.4s ease-in-out infinite",
            }} />
          )}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 8,
      }}>
        {badges.map(b => {
          const earned = currentValue >= b.lots;
          const th = COMMERCIAL_TIER[earned ? b.tier : 0];

          return (
            <div key={b.id} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "12px 8px",
              borderRadius: 12,
              background: earned
                ? `linear-gradient(160deg, ${th.bg1}ee, ${th.bg2}bb)`
                : "rgba(255,255,255,0.025)",
              border: `1px solid ${earned ? th.border + "88" : "#1e1e2e"}`,
              boxShadow: earned && th.glow ? `0 0 12px ${th.accent}18` : "none",
              position: "relative", overflow: "hidden",
              transition: "all 0.2s",
            }}>
              {earned && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: `radial-gradient(ellipse at 50% 0%, ${th.accent}12, transparent 65%)`,
                  pointerEvents: "none",
                }} />
              )}
              <CommercialBadge tier={earned ? b.tier : 0} locked={!earned} size={48} icon="star" />
              <span style={{
                fontSize: 10, fontWeight: 900,
                color: earned ? "#ffffff" : "#a0a0c0",
                marginTop: 8, lineHeight: 1,
                textShadow: earned ? `0 0 8px ${th.accent}66` : "none",
              }}>
                {b.lots} lotes
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 800,
                color: earned ? "#ffffff" : "#d0d0e8",
                textAlign: "center", lineHeight: 1.3,
                marginTop: 4,
              }}>
                {b.label}
              </span>
              {earned && (
                <div style={{
                  marginTop: 6,
                  padding: "2px 7px",
                  borderRadius: 99,
                  background: `${th.accent}22`,
                  border: `1px solid ${th.accent}44`,
                }}>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: th.labelColor, letterSpacing: "0.04em" }}>
                    PERMANENTE
                  </span>
                </div>
              )}
              {earned && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  width: 13, height: 13, borderRadius: "50%",
                  background: th.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 7px ${th.accent}88`,
                }}>
                  <svg width={7} height={7} viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#050510" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MODAL DE REPUTACIÓN ──────────────────────────────────────────────────────
function ProgressModal({
  onClose, currentStreak, streakBadges, milestoneBadges, completedLots, paymentLevel,
}: {
  onClose: () => void;
  currentStreak: number; streakBadges: string[]; milestoneBadges: string[];
  completedLots: number; paymentLevel: number;
}) {
  const [tab, setTab] = useState<"streak" | "milestone" | "level">("streak");

  const TABS = [
    { id: "streak"    as const, label: "Racha de lotes", color: "#2090e0", emoji: "⚡" },
    { id: "milestone" as const, label: "Logros",          color: "#d0a030", emoji: "🏆" },
    { id: "level"     as const, label: "Nivel",           color: "#40b860", emoji: "🎖️" },
  ];

  const topStreakBadge  = [...STREAK_BADGES_DATA].reverse().find(b => streakBadges.includes(b.id)) ?? null;
  const nextStreakBadge = STREAK_BADGES_DATA.find(b => currentStreak < b.streak);
  const ptsToNext       = nextStreakBadge ? nextStreakBadge.streak - currentStreak : 0;

  const activeDiscount = (() => {
    let best = { shipping: 0, commission: 0, label: "Sin descuento aún" };
    for (const [pts, disc] of Object.entries(STREAK_DISCOUNTS)) {
      if (currentStreak >= Number(pts)) best = disc;
    }
    return best;
  })();

  const topMilestoneBadge  = [...MILESTONE_BADGES_DATA].reverse().find(b => milestoneBadges.includes(b.id)) ?? null;
  const nextMilestoneBadge = MILESTONE_BADGES_DATA.find(b => completedLots < b.lots);
  const lotsToNext         = nextMilestoneBadge ? nextMilestoneBadge.lots - completedLots : 0;

  const STREAK_COLOR    = "#2090e0";
  const MILESTONE_COLOR = "#d0a030";

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0,
        background: "rgba(4,6,20,0.88)",
        backdropFilter: "blur(16px)",
        zIndex: 1000,
        animation: "urh-fadeIn 0.2s ease-out",
      }} />

      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 1001,
        width: 660, maxWidth: "calc(100vw - 24px)",
        maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "linear-gradient(160deg, #0c0e1c 0%, #111420 55%, #090c18 100%)",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04) inset",
        overflow: "hidden",
        animation: "urh-modalIn 0.25s cubic-bezier(0.34,1.4,0.64,1)",
      }}>
        <div style={{ padding: "22px 26px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#eef0f8", letterSpacing: "-0.02em" }}>
                Mi Reputación
              </div>
              <div style={{ fontSize: 12, color: "#50527a", marginTop: 3, fontWeight: 500 }}>
                Mayorista Móvil · Credenciales y progreso
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#7070a0", fontSize: 20, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#c0c0e0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#7070a0"; }}
            >×</button>
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: "11px 6px", border: "none",
                background: tab === t.id ? `${t.color}10` : "transparent",
                borderBottom: tab === t.id ? `2.5px solid ${t.color}` : "2.5px solid transparent",
                color: tab === t.id ? t.color : "#40405a",
                fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                letterSpacing: "0.05em", textTransform: "uppercase",
                transition: "all 0.15s", borderRadius: "6px 6px 0 0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                <span>{t.emoji}</span><span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "24px 26px 28px", overflowY: "auto", flex: 1 }}>

          {tab === "streak" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
                <div style={{
                  flex: "1 1 130px", padding: "14px 16px",
                  background: "rgba(32,144,224,0.08)",
                  border: "1px solid rgba(32,144,224,0.2)",
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#304868", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                    Puntos actuales
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: STREAK_COLOR, textShadow: `0 0 28px ${STREAK_COLOR}66`, lineHeight: 1 }}>
                      {currentStreak}
                    </span>
                    <span style={{ fontSize: 14, color: "#304868", fontWeight: 700 }}>pts</span>
                  </div>
                </div>

                {topStreakBadge && (() => {
                  const th = COMMERCIAL_TIER[topStreakBadge.tier];
                  return (
                    <div style={{
                      flex: "1 1 130px", padding: "14px 16px",
                      background: `${th.accent}10`,
                      border: `1px solid ${th.accent}28`,
                      borderRadius: 12,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#606080", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                        Último logro
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", lineHeight: 1.2, marginBottom: 4 }}>
                        {topStreakBadge.label}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: th.labelColor }}>
                        {STREAK_DISCOUNTS[topStreakBadge.streak]?.label}
                      </div>
                    </div>
                  );
                })()}

                <div style={{
                  flex: "1 1 130px", padding: "14px 16px",
                  background: currentStreak > 0 ? "rgba(32,144,224,0.06)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${currentStreak > 0 ? "rgba(32,144,224,0.18)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#404060", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                    Descuento activo
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: currentStreak > 0 ? "#ffffff" : "#404058", lineHeight: 1.2 }}>
                    {activeDiscount.label}
                  </div>
                  {nextStreakBadge && (
                    <div style={{ fontSize: 10, color: "#607090", marginTop: 5, fontWeight: 600 }}>
                      Próximo: <span style={{ color: STREAK_COLOR }}>{STREAK_DISCOUNTS[nextStreakBadge.streak]?.label}</span> en {ptsToNext} pts
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#404060", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                  Progreso · descuentos por credencial
                </div>
                <StreakTimelineBar
                  badges={STREAK_BADGES_DATA}
                  currentValue={currentStreak}
                  maxValue={50}
                  color={STREAK_COLOR}
                />
              </div>

              <div style={{
                marginTop: 16, padding: "11px 14px",
                background: "rgba(32,144,224,0.05)", borderRadius: 10,
                border: "1px solid rgba(32,144,224,0.1)",
                fontSize: 11, color: "#4a6880", lineHeight: 1.6,
              }}>
                ⚡ Cada lote pagado suma +1 punto. Cancelar resta −1. Las credenciales de racha son dinámicas.
              </div>
            </div>
          )}

          {tab === "milestone" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
                <div style={{
                  flex: "1 1 130px", padding: "14px 16px",
                  background: "rgba(208,160,48,0.08)",
                  border: "1px solid rgba(208,160,48,0.2)",
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#705830", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                    Lotes completados
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: MILESTONE_COLOR, textShadow: `0 0 28px ${MILESTONE_COLOR}66`, lineHeight: 1 }}>
                      {completedLots}
                    </span>
                    <span style={{ fontSize: 14, color: "#705830", fontWeight: 700 }}>lotes</span>
                  </div>
                </div>

                {topMilestoneBadge && (() => {
                  const th = COMMERCIAL_TIER[topMilestoneBadge.tier];
                  return (
                    <div style={{
                      flex: "1 1 130px", padding: "14px 16px",
                      background: `${th.accent}10`,
                      border: `1px solid ${th.accent}28`,
                      borderRadius: 12,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#606080", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                        Último logro
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", lineHeight: 1.2 }}>
                        {topMilestoneBadge.label}
                      </div>
                      <div style={{ fontSize: 10, color: th.labelColor, marginTop: 4, fontWeight: 600 }}>
                        Permanente · nunca se pierde
                      </div>
                    </div>
                  );
                })()}

                {nextMilestoneBadge && (
                  <div style={{
                    flex: "1 1 130px", padding: "14px 16px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#404060", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                      Próximo logro
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#d0d0e8", lineHeight: 1.2 }}>
                      {nextMilestoneBadge.label}
                    </div>
                    <div style={{ fontSize: 11, color: MILESTONE_COLOR, fontWeight: 700, marginTop: 3 }}>
                      faltan {lotsToNext} lotes
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#404060", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                  Credenciales permanentes
                </div>
                <MilestoneTimelineBar
                  badges={MILESTONE_BADGES_DATA}
                  currentValue={completedLots}
                  maxValue={50}
                  color={MILESTONE_COLOR}
                />
              </div>

              <div style={{
                marginTop: 16, padding: "11px 14px",
                background: "rgba(208,160,48,0.05)", borderRadius: 10,
                border: "1px solid rgba(208,160,48,0.1)",
                fontSize: 11, color: "#706040", lineHeight: 1.6,
              }}>
                🏆 Los logros permanentes son tuyo para siempre, aunque canceles reservas.
              </div>
            </div>
          )}

          {tab === "level" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#404060", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>
                Nivel de confianza
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                {LEVEL_DATA.map(b => {
                  const active = b.level === paymentLevel;
                  const th = COMMERCIAL_TIER[active ? b.tier : 0];
                  return (
                    <div key={b.level} style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "18px 14px 16px",
                      borderRadius: 14,
                      background: active
                        ? `linear-gradient(145deg, ${b.bg}ee, ${b.bg}88)`
                        : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${active ? b.border + "66" : "#202030"}`,
                      boxShadow: active ? `0 0 24px ${b.border}22, inset 0 1px 0 ${b.border}18` : "none",
                      transition: "all 0.2s",
                      position: "relative", overflow: "hidden",
                    }}>
                      {active && (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: `radial-gradient(ellipse at 50% 0%, ${b.border}12, transparent 65%)`,
                          pointerEvents: "none",
                        }} />
                      )}
                      <div style={{ position: "relative", marginBottom: 10 }}>
                        <CommercialBadge
                          tier={active ? b.tier : 0}
                          locked={!active}
                          size={active ? 72 : 60}
                          icon={b.icon}
                          animPulse={active}
                        />
                        {active && (
                          <div style={{
                            position: "absolute", bottom: -2, left: "50%",
                            transform: "translateX(-50%)",
                            background: th.accent,
                            borderRadius: 99, padding: "2px 9px",
                            fontSize: 8, fontWeight: 900,
                            color: "#050510", letterSpacing: "0.1em",
                            whiteSpace: "nowrap",
                            boxShadow: `0 0 10px ${th.accent}88`,
                          }}>
                            ACTIVO
                          </div>
                        )}
                      </div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        padding: "4px 14px", borderRadius: 7,
                        background: active ? `${b.border}25` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${active ? b.border + "55" : "#252535"}`,
                        marginBottom: 5, marginTop: 6,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 900,
                          color: active ? "#ffffff" : "#d0d0e8",
                          letterSpacing: "0.03em",
                          textShadow: active ? `0 0 12px ${b.text}80` : "none",
                        }}>
                          {b.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#ffffff" : "#9090b0" }}>
                        {b.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                padding: "13px 16px",
                background: "rgba(64,184,96,0.05)", borderRadius: 11,
                border: "1px solid rgba(64,184,96,0.12)",
                fontSize: 11, color: "#405840", lineHeight: 1.65,
              }}>
                💡 El nivel mejora automáticamente cuando pagás en tiempo. Cada pago puntual suma a tu score de confianza.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── PILL DEL HEADER ──────────────────────────────────────────────────────────
function HeaderPill({
  tier, icon, label, sublabel, color, onClick, pulse,
}: {
  tier: number; icon: IconType; label: string; sublabel?: string; color: string;
  onClick: () => void; pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label}${sublabel ? ` · ${sublabel}` : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 10px 3px 3px",
        background: `${color}10`, border: `1px solid ${color}25`,
        borderRadius: 99, cursor: "pointer",
        animation: pulse ? "urh-pill-pulse 2.5s ease-in-out infinite" : undefined,
        transition: "all 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}20`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}45`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}10`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}25`; }}
    >
      <CommercialBadge tier={tier} locked={false} size={24} icon={icon} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color, lineHeight: 1, letterSpacing: "0.02em" }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: 9, color: `${color}99`, lineHeight: 1, marginTop: 1 }}>
            {sublabel}
          </span>
        )}
      </div>
      <span style={{ fontSize: 9, color, opacity: 0.4, marginLeft: 2 }}>›</span>
    </button>
  );
}

// ─── LABELS DE ROLES ──────────────────────────────────────────────────────────
// ✅ NUEVO: mapa de todos los roles a su etiqueta en español
const ROLE_LABELS: Record<Role, string> = {
  manufacturer: "Fabricante",
  retailer:     "Revendedor",
  distributor:  "Distribuidor",
  wholesaler:   "Mayorista",
};

// ✅ NUEVO: color del punto y texto según el rol
const ROLE_COLORS: Record<Role, { dot: string; text: string; avatar: string }> = {
  manufacturer: { dot: "#3b82f6", text: "#1d4ed8", avatar: "linear-gradient(135deg,#1d4ed8,#3b82f6)" },
  retailer:     { dot: "#8b5cf6", text: "#6d28d9", avatar: "linear-gradient(135deg,#6d28d9,#8b5cf6)" },
  distributor:  { dot: "#9333ea", text: "#7e22ce", avatar: "linear-gradient(135deg,#7e22ce,#a855f7)" },
  wholesaler:   { dot: "#16a34a", text: "#15803d", avatar: "linear-gradient(135deg,#15803d,#22c55e)" },
};

// ─── FEATURE FLAG ─────────────────────────────────────────────────────────────
// Poner en true para re-habilitar el sistema de gamificación (badges, rachas, niveles)
const SHOW_GAMIFICATION = false;

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
interface UserRoleHeaderProps {
  userEmail?: string;
  // ✅ ACTUALIZADO: acepta los 4 roles
  activeRole: Role;
  userName?: string;
  milestoneBadges?: string[];
  streakBadges?: string[];
  currentStreak?: number;
  paymentLevel?: number;
  completedLots?: number;
  scoreValue?: number;
}

export default function UserRoleHeader({
  userEmail,
  activeRole,
  userName,
  milestoneBadges = [],
  streakBadges    = [],
  currentStreak   = 0,
  paymentLevel    = 2,
  completedLots   = 0,
  scoreValue      = 0.5,
}: UserRoleHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // ✅ Usando los mapas de colores y labels para todos los roles
  const isRetailer    = activeRole === "retailer";
  const currentLabel  = ROLE_LABELS[activeRole] ?? activeRole;
  const colors        = ROLE_COLORS[activeRole] ?? ROLE_COLORS.manufacturer;

  const initials = userName
    ? userName.slice(0, 2).toUpperCase()
    : userEmail ? userEmail.slice(0, 2).toUpperCase() : "?";

  const topStreakBadge    = [...STREAK_BADGES_DATA].reverse().find(b => streakBadges.includes(b.id)) ?? null;
  const topMilestoneBadge = [...MILESTONE_BADGES_DATA].reverse().find(b => milestoneBadges.includes(b.id)) ?? null;
  const levelEntry        = LEVEL_DATA.find(l => l.level === paymentLevel) ?? LEVEL_DATA[1];
  const levelTh           = COMMERCIAL_TIER[levelEntry.tier];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 18, padding: "10px 16px 10px 14px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          minWidth: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: colors.avatar,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 14,
            flexShrink: 0, letterSpacing: "0.04em",
            boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
          }}>
            {initials}
          </div>

          {/* Info + pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
            <span style={{
              fontSize: 12, color: "#6b7280",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: 200, lineHeight: 1.3,
            }}>
              {userEmail || "Sin sesión"}
            </span>
            {/* ✅ Muestra el rol correcto para los 4 tipos */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: colors.text, lineHeight: 1.3 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.dot, display: "inline-block", flexShrink: 0 }} />
              Rol activo: {currentLabel}
            </span>

            {/* Badges — temporalmente ocultos (SHOW_GAMIFICATION = false) */}
            {SHOW_GAMIFICATION && isRetailer && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3 }}>
                <HeaderPill
                  tier={levelEntry.tier} icon={levelEntry.icon}
                  label={levelEntry.label} sublabel={levelEntry.desc}
                  color={levelTh.labelColor}
                  onClick={() => setModalOpen(true)}
                />
                {currentStreak > 0 && (
                  <HeaderPill
                    tier={topStreakBadge?.tier ?? 1} icon="bolt"
                    label={topStreakBadge ? topStreakBadge.label : "Racha activa"}
                    sublabel={`${currentStreak} pts ⚡`}
                    color="#2090e0"
                    onClick={() => setModalOpen(true)}
                    pulse={!!topStreakBadge}
                  />
                )}
                {topMilestoneBadge && (
                  <HeaderPill
                    tier={topMilestoneBadge.tier} icon="star"
                    label={topMilestoneBadge.label}
                    sublabel={`${completedLots} lotes`}
                    color="#d0a030"
                    onClick={() => setModalOpen(true)}
                  />
                )}
              </div>
            )}
          </div>

          {/* ✅ ELIMINADO: el divider y el botón "Cambiar a..." que estaban aquí */}
        </div>
      </div>

      {/* Modal — temporalmente oculto (SHOW_GAMIFICATION = false) */}
      {SHOW_GAMIFICATION && modalOpen && isRetailer && (
        <ProgressModal
          onClose={() => setModalOpen(false)}
          currentStreak={currentStreak}
          streakBadges={streakBadges}
          milestoneBadges={milestoneBadges}
          completedLots={completedLots}
          paymentLevel={paymentLevel}
        />
      )}

      <style>{`
        @keyframes urh-badge-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes urh-head-pulse    { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1} 50%{transform:translate(-50%,-50%) scale(1.45);opacity:0.55} }
        @keyframes urh-pill-pulse    { 0%,100%{box-shadow:0 0 0 0 rgba(32,144,224,0)} 50%{box-shadow:0 0 0 4px rgba(32,144,224,0.18)} }
        @keyframes urh-fadeIn        { from{opacity:0} to{opacity:1} }
        @keyframes urh-modalIn       { from{opacity:0;transform:translate(-50%,-46%) scale(0.92)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>
    </>
  );
}