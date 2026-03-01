// lib/retailers/calculateScore.ts
//
// Calcula score, nivel, comisión, racha y badges de un retailer
// basado en su historial completo de reservas cerradas.
//
// SCORE FINAL = (velocidadPromedio × 0.5) + (tasaCompletado × 0.5)
//
// Velocidad por reserva:
//   0-16h  → 1.0
//   12-24h → 0.75
//   24-48h → 0.50
//   48-72h → 0.25
//   no pagó / canceló → 0
//
// Nivel resultante:
//   Sin historial → nivel 2 (beneficio de la duda)
//   score >= 0.75 → nivel 1
//   score >= 0.50 → nivel 2
//   score >= 0.25 → nivel 3
//   score <  0.25 → nivel 4
//
// Comisión por nivel:
//   Nivel 1 → 9%
//   Nivel 2 → 12%
//   Nivel 3 → 14%
//   Nivel 4 → 16%
//
// ── BLOQUE 1 — Sistema de puntos de racha ──────────────────────────────────
// Hace una reserva (paga)  → +1 punto de racha
// Cancela / se baja        → -1 punto de racha (mínimo 0)
// Los badges de racha se asignan por puntos acumulados (DINÁMICOS, se pierden):
//   1  pt → "Primer Vínculo"
//   3  pt → "Explorador"
//   6  pt → "Constante"
//   10 pt → "Comprometido"
//   14 pt → "Imparable"
//   20 pt → "VIP Bronce"
//   27 pt → "VIP Plata"
//   40 pt → "VIP Oro"
//   50 pt → "Leyenda"
//
// ── Descuentos en envío por puntos de racha ────────────────────────────────
//   1  pt → 10% descuento en envío
//   3  pt → 25%
//   6  pt → 30%
//   10 pt → 35%
//   14 pt → 40%
//   20 pt → 45%
//   27 pt → 50%
//   40 pt → 55%
//   50 pt → 100% descuento en comisión Y envío (lote completamente gratis)
//
// ── Badges de milestone (PERMANENTES, nunca se pierden) ────────────────────
//   1  lote → "Primer Vinculo"
//   10 lotes → "Revendedor Tallado"
//   25 lotes → "Maestro del Sector"
//   35 lotes → "Socio Estratégico"     ← NUEVO
//   50 lotes → "Socio Fundador de MayoristaMovil"

import { db } from "../firebase-admin";

export type PaymentLevel = 1 | 2 | 3 | 4;

// ── BLOQUE 1 — Badges de racha (dinámicos, se pierden al cancelar/bajar) ──
// Números que rompen el patrón esperado para activar respuesta dopaminérgica
export const STREAK_BADGES: { streak: number; id: string; label: string }[] = [
  { streak: 1,  id: "streak_start",     label: "Primer Vínculo"  },
  { streak: 3,  id: "streak_explorer",  label: "Explorador"      },
  { streak: 6,  id: "streak_steady",    label: "Constante"       },
  { streak: 10, id: "streak_committed", label: "Comprometido"    },
  { streak: 14, id: "streak_unstop",    label: "Imparable"       },
  { streak: 20, id: "streak_vip_b",     label: "VIP Bronce"      },
  { streak: 27, id: "streak_vip_s",     label: "VIP Plata"       },
  { streak: 40, id: "streak_vip_g",     label: "VIP Oro"         },
  { streak: 50, id: "streak_legend",    label: "Leyenda"         },
];

// ── Descuentos por puntos de racha ─────────────────────────────────────────
// shippingDiscount: fracción de descuento sobre el costo de envío (0.0 - 1.0)
// commissionDiscount: fracción de descuento sobre la comisión (0.0 - 1.0)
// En 50 puntos: lote completamente gratis (envío + comisión = 0)
export const STREAK_SHIPPING_DISCOUNTS: {
  streak: number;
  shippingDiscount: number;
  commissionDiscount: number;
}[] = [
  { streak: 1,  shippingDiscount: 0.10, commissionDiscount: 0    },
  { streak: 3,  shippingDiscount: 0.25, commissionDiscount: 0    },
  { streak: 6,  shippingDiscount: 0.30, commissionDiscount: 0    },
  { streak: 10, shippingDiscount: 0.35, commissionDiscount: 0    },
  { streak: 14, shippingDiscount: 0.40, commissionDiscount: 0    },
  { streak: 20, shippingDiscount: 0.45, commissionDiscount: 0    },
  { streak: 27, shippingDiscount: 0.50, commissionDiscount: 0    },
  { streak: 40, shippingDiscount: 0.55, commissionDiscount: 0    },
  { streak: 50, shippingDiscount: 1.00, commissionDiscount: 1.00 }, // lote gratis
];

/** Dado un puntaje de racha, devuelve los descuentos activos */
export function getStreakDiscounts(streakPoints: number): {
  shippingDiscount: number;
  commissionDiscount: number;
} {
  let shippingDiscount = 0;
  let commissionDiscount = 0;
  for (const tier of STREAK_SHIPPING_DISCOUNTS) {
    if (streakPoints >= tier.streak) {
      shippingDiscount = tier.shippingDiscount;
      commissionDiscount = tier.commissionDiscount;
    }
  }
  return { shippingDiscount, commissionDiscount };
}

// ── Badges de milestone (PERMANENTES, nunca se pierden) ─────────────────────
export const MILESTONE_BADGES: { lots: number; id: string; label: string }[] = [
  { lots: 1,  id: "milestone_first",      label: "Primer Vinculo"                   },
  { lots: 10, id: "milestone_solid",      label: "Revendedor Tallado"               },
  { lots: 25, id: "milestone_operator",   label: "Maestro del Sector"               },
  { lots: 35, id: "milestone_strategic",  label: "Socio Estratégico"                }, // NUEVO
  { lots: 50, id: "milestone_founding",   label: "Socio Fundador de MayoristaMovil" },
];

export interface RetailerScore {
  score: number;
  level: PaymentLevel;
  commission: number;              // porcentaje a aplicar (11, 12, 13 o 14)
  totalReservations: number;
  completedReservations: number;
  currentStreak: number;           // puntos de racha actuales (sube/baja)
  longestStreak: number;           // máximo histórico de puntos (nunca baja)
  streakBadges: string[];          // badges de racha activos (dinámicos)
  milestoneBadges: string[];       // badges de milestone ganados (permanentes)
  shippingDiscount: number;        // descuento activo en envío (0.0 - 1.0)
  commissionDiscount: number;      // descuento activo en comisión (0.0 - 1.0)
}

// ── Helpers ───────────────────────────────────────────────────────

function speedScore(hoursToPayment: number): number {
  if (hoursToPayment <= 16) return 1.0;
  if (hoursToPayment <= 24) return 0.75;
  if (hoursToPayment <= 48) return 0.50;
  if (hoursToPayment <= 72) return 0.25;
  return 0;
}

function scoreToLevel(score: number, hasHistory: boolean): PaymentLevel {
  if (!hasHistory) return 2;
  if (score >= 0.75) return 1;
  if (score >= 0.50) return 2;
  if (score >= 0.25) return 3;
  return 4;
}

function levelToCommission(level: PaymentLevel): number {
  switch (level) {
    case 1: return 9;
    case 2: return 12;
    case 3: return 14;
    case 4: return 16;
  }
}

function computeStreakBadges(streakPoints: number): string[] {
  return STREAK_BADGES
    .filter((b) => streakPoints >= b.streak)
    .map((b) => b.id);
}

function computeMilestoneBadges(totalPaid: number): string[] {
  return MILESTONE_BADGES
    .filter((b) => totalPaid >= b.lots)
    .map((b) => b.id);
}

/** Aplica delta de racha, clampea entre 0 e Infinity */
export function applyStreakDelta(currentPoints: number, delta: number): number {
  return Math.max(0, currentPoints + delta);
}

// ── Cálculo principal (full recalc) ──────────────────────────────
// Se usa solo en migración / recálculo manual de admin.
// Los pagos normales usan updateRetailerScoreIncremental (2 ops Firestore).

export async function calculateRetailerScore(retailerId: string): Promise<RetailerScore> {
  const existingSnap = await db.collection("retailers").doc(retailerId).get();
  const existing = existingSnap.data() || {};
  const previousLongestStreak: number     = existing.longestStreak ?? 0;
  const previousMilestoneBadges: string[] = existing.milestoneBadges ?? [];

  const snap = await db
    .collection("reservations")
    .where("retailerId", "==", retailerId)
    .where("status", "in", ["paid", "cancelled"])
    .get();

  if (snap.empty) {
    return {
      score: 0.6,
      level: 2,
      commission: 12,
      totalReservations: 0,
      completedReservations: 0,
      currentStreak: 0,
      longestStreak: previousLongestStreak,
      streakBadges: [],
      milestoneBadges: previousMilestoneBadges,
      shippingDiscount: 0,
      commissionDiscount: 0,
    };
  }

  const sortedDocs = snap.docs.slice().sort((a, b) => {
    const aMs = a.data().lotClosedAt?.toMillis?.() ?? 0;
    const bMs = b.data().lotClosedAt?.toMillis?.() ?? 0;
    return aMs - bMs;
  });

  let totalSpeed    = 0;
  let speedCount    = 0;
  let paid          = 0;
  let total         = 0;
  let streakPoints  = 0;
  let longestStreak = previousLongestStreak;

  for (const doc of sortedDocs) {
    const r = doc.data();
    total++;

    if (r.status === "paid") {
      paid++;
      // Reserva pagada → +1 punto de racha
      streakPoints = applyStreakDelta(streakPoints, 1);
      if (streakPoints > longestStreak) longestStreak = streakPoints;

      const closedAt: number = r.lotClosedAt?.toMillis?.() ?? 0;
      const paidAt: number   = r.paidAt?.toMillis?.() ?? 0;

      if (closedAt && paidAt && paidAt > closedAt) {
        totalSpeed += speedScore((paidAt - closedAt) / (1000 * 60 * 60));
        speedCount++;
      } else {
        totalSpeed += 0.5;
        speedCount++;
      }
    } else {
      // Cancelación / baja → -1 punto de racha
      streakPoints = applyStreakDelta(streakPoints, -1);
    }
  }

  const completionRate = total > 0 ? paid / total : 0;
  const speedAvg       = speedCount > 0 ? totalSpeed / speedCount : 0;
  const score          = (speedAvg * 0.5) + (completionRate * 0.5);
  const level          = scoreToLevel(score, total > 0);
  const commission     = levelToCommission(level);

  const streakBadges    = computeStreakBadges(streakPoints);
  const milestoneBadges = computeMilestoneBadges(paid);
  const { shippingDiscount, commissionDiscount } = getStreakDiscounts(streakPoints);

  // Reconstruir agregado en Firestore
  await db.collection("retailers").doc(retailerId).set(
    {
      scoreAggregate: {
        totalReservations: total,
        completedReservations: paid,
        totalSpeedSum: totalSpeed,
        speedCount,
        currentStreak: streakPoints,
        longestStreak,
        rebuiltAt: new Date(),
      },
    },
    { merge: true }
  );

  return {
    score,
    level,
    commission,
    totalReservations: total,
    completedReservations: paid,
    currentStreak: streakPoints,
    longestStreak,
    streakBadges,
    milestoneBadges,
    shippingDiscount,
    commissionDiscount,
  };
}

// ── Actualización incremental (llamada desde el webhook al pagar) ──────────
// También se llama al cancelar desde /api/reservations/cancel
// +1 punto al pagar, -1 punto al cancelar

export async function updateRetailerScoreIncremental(params: {
  retailerId: string;
  paidAt: number;
  lotClosedAt: number;
  wasCancelled?: boolean;
}): Promise<RetailerScore> {
  const { retailerId, paidAt, lotClosedAt, wasCancelled = false } = params;

  const retailerRef  = db.collection("retailers").doc(retailerId);
  const retailerSnap = await retailerRef.get();
  const existing     = retailerSnap.data() || {};
  const agg          = existing.scoreAggregate as Record<string, number> | undefined;

  if (!agg || typeof agg.totalReservations !== "number") {
    console.log(`[score] No hay agregado para ${retailerId} → full recalc`);
    return updateRetailerScore(retailerId);
  }

  let hours = 999;
  let speed = 0.5;
  if (!wasCancelled && lotClosedAt > 0 && paidAt > lotClosedAt) {
    hours = (paidAt - lotClosedAt) / (1000 * 60 * 60);
    speed = speedScore(hours);
  }

  const prevTotal      = agg.totalReservations;
  const prevPaid       = agg.completedReservations;
  const prevSpeedSum   = agg.totalSpeedSum ?? 0;
  const prevSpeedCount = agg.speedCount ?? 0;
  const prevStreak     = agg.currentStreak ?? 0;
  const prevLongest    = agg.longestStreak ?? (existing.longestStreak ?? 0);

  const newTotal      = prevTotal + 1;
  const newPaid       = wasCancelled ? prevPaid : prevPaid + 1;
  const newSpeedSum   = wasCancelled ? prevSpeedSum : prevSpeedSum + speed;
  const newSpeedCount = wasCancelled ? prevSpeedCount : prevSpeedCount + 1;

  // BLOQUE 1: +1 al pagar, -1 al cancelar
  const newStreak  = applyStreakDelta(prevStreak, wasCancelled ? -1 : 1);
  const newLongest = Math.max(prevLongest, newStreak);

  const completionRate = newTotal > 0 ? newPaid / newTotal : 0;
  const speedAvg       = newSpeedCount > 0 ? newSpeedSum / newSpeedCount : 0;
  const score          = (speedAvg * 0.5) + (completionRate * 0.5);
  const level          = scoreToLevel(score, newTotal > 0);
  const commission     = levelToCommission(level);

  const streakBadges    = computeStreakBadges(newStreak);
  const milestoneBadges = computeMilestoneBadges(newPaid);

  // Milestones permanentes — nunca se pierden
  const existingMilestones: string[] = existing.milestoneBadges ?? [];
  const mergedMilestones = Array.from(new Set([...existingMilestones, ...milestoneBadges]));

  const { shippingDiscount, commissionDiscount } = getStreakDiscounts(newStreak);

  await retailerRef.set(
    {
      reliabilityScore:      score,
      paymentLevel:          level,
      commission,
      totalReservations:     newTotal,
      completedReservations: newPaid,
      currentStreak:         newStreak,
      longestStreak:         newLongest,
      streakBadges,
      milestoneBadges:       mergedMilestones,
      shippingDiscount,
      commissionDiscount,
      scoreUpdatedAt:        new Date(),
      scoreAggregate: {
        totalReservations:   newTotal,
        completedReservations: newPaid,
        totalSpeedSum:       newSpeedSum,
        speedCount:          newSpeedCount,
        currentStreak:       newStreak,
        longestStreak:       newLongest,
        lastUpdatedAt:       new Date(),
      },
    },
    { merge: true }
  );

  return {
    score,
    level,
    commission,
    totalReservations: newTotal,
    completedReservations: newPaid,
    currentStreak: newStreak,
    longestStreak: newLongest,
    streakBadges,
    milestoneBadges: mergedMilestones,
    shippingDiscount,
    commissionDiscount,
  };
}

// ── Guardar en Firestore (full recalc) ────────────────────────────

export async function updateRetailerScore(retailerId: string): Promise<RetailerScore> {
  const result = await calculateRetailerScore(retailerId);

  await db.collection("retailers").doc(retailerId).set(
    {
      reliabilityScore:      result.score,
      paymentLevel:          result.level,
      commission:            result.commission,
      totalReservations:     result.totalReservations,
      completedReservations: result.completedReservations,
      currentStreak:         result.currentStreak,
      longestStreak:         result.longestStreak,
      streakBadges:          result.streakBadges,
      milestoneBadges:       result.milestoneBadges,
      shippingDiscount:      result.shippingDiscount,
      commissionDiscount:    result.commissionDiscount,
      scoreUpdatedAt:        new Date(),
    },
    { merge: true }
  );

  return result;
}