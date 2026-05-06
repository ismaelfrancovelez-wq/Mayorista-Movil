// lib/retailers/calculateScore.ts
//
// REFACTOR: el sistema de NIVELES (Nivel 1-4 con comisión 9-16%) fue ELIMINADO.
// También se eliminaron los descuentos económicos por racha.
//
// Lo que SE MANTIENE:
//   - Score interno (0-1) para auditoría/análisis
//   - Racha actual y máxima histórica (cosmético, se muestra al usuario)
//   - Badges de racha (cosmético, dinámicos por puntos)
//   - Badges de milestone (cosmético, permanentes por lotes pagados)
//
// Lo que NO se calcula ya:
//   - paymentLevel (era 1, 2, 3 o 4)
//   - commission (era 9, 12, 14 o 16)
//   - shippingDiscount (era 10% a 100% según racha)
//   - commissionDiscount (era 0 a 100% según racha)

import { db } from "../firebase-admin";

// ── Badges de racha (dinámicos, se pierden al cancelar/bajar) ──
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

// ── Badges de milestone (permanentes) ──
export const MILESTONE_BADGES: { lots: number; id: string; label: string }[] = [
  { lots: 1,  id: "milestone_first",     label: "Primer Vinculo"                   },
  { lots: 10, id: "milestone_solid",     label: "Revendedor Tallado"               },
  { lots: 25, id: "milestone_operator",  label: "Maestro del Sector"               },
  { lots: 35, id: "milestone_strategic", label: "Socio Estratégico"                },
  { lots: 50, id: "milestone_founding",  label: "Socio Fundador de MayoristaMovil" },
];

export interface RetailerScore {
  score: number;
  totalReservations: number;
  completedReservations: number;
  currentStreak: number;
  longestStreak: number;
  streakBadges: string[];
  milestoneBadges: string[];
}

// ─────────── Helpers internos ───────────

function speedScore(hoursToPayment: number): number {
  if (hoursToPayment <= 16) return 1.0;
  if (hoursToPayment <= 24) return 0.75;
  if (hoursToPayment <= 48) return 0.50;
  if (hoursToPayment <= 72) return 0.25;
  return 0;
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

export function applyStreakDelta(currentPoints: number, delta: number): number {
  return Math.max(0, currentPoints + delta);
}

// ─────────── Cálculo principal (full recalc) ───────────

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
      totalReservations: 0,
      completedReservations: 0,
      currentStreak: 0,
      longestStreak: previousLongestStreak,
      streakBadges: [],
      milestoneBadges: previousMilestoneBadges,
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
      streakPoints = applyStreakDelta(streakPoints, -1);
    }
  }

  const completionRate = total > 0 ? paid / total : 0;
  const speedAvg       = speedCount > 0 ? totalSpeed / speedCount : 0;
  const score          = (speedAvg * 0.5) + (completionRate * 0.5);

  const streakBadges    = computeStreakBadges(streakPoints);
  const milestoneBadges = computeMilestoneBadges(paid);

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
    totalReservations: total,
    completedReservations: paid,
    currentStreak: streakPoints,
    longestStreak,
    streakBadges,
    milestoneBadges,
  };
}

// ─────────── Actualización incremental (llamada desde el webhook) ───────────

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

  const newStreak  = applyStreakDelta(prevStreak, wasCancelled ? -1 : 1);
  const newLongest = Math.max(prevLongest, newStreak);

  const completionRate = newTotal > 0 ? newPaid / newTotal : 0;
  const speedAvg       = newSpeedCount > 0 ? newSpeedSum / newSpeedCount : 0;
  const score          = (speedAvg * 0.5) + (completionRate * 0.5);

  const streakBadges    = computeStreakBadges(newStreak);
  const milestoneBadges = computeMilestoneBadges(newPaid);

  const existingMilestones: string[] = existing.milestoneBadges ?? [];
  const mergedMilestones = Array.from(new Set([...existingMilestones, ...milestoneBadges]));

  await retailerRef.set(
    {
      reliabilityScore:      score,
      totalReservations:     newTotal,
      completedReservations: newPaid,
      currentStreak:         newStreak,
      longestStreak:         newLongest,
      streakBadges,
      milestoneBadges:       mergedMilestones,
      scoreUpdatedAt:        new Date(),
      scoreAggregate: {
        totalReservations:     newTotal,
        completedReservations: newPaid,
        totalSpeedSum:         newSpeedSum,
        speedCount:            newSpeedCount,
        currentStreak:         newStreak,
        longestStreak:         newLongest,
        lastUpdatedAt:         new Date(),
      },
    },
    { merge: true }
  );

  return {
    score,
    totalReservations: newTotal,
    completedReservations: newPaid,
    currentStreak: newStreak,
    longestStreak: newLongest,
    streakBadges,
    milestoneBadges: mergedMilestones,
  };
}

export async function updateRetailerScore(retailerId: string): Promise<RetailerScore> {
  const result = await calculateRetailerScore(retailerId);

  await db.collection("retailers").doc(retailerId).set(
    {
      reliabilityScore:      result.score,
      totalReservations:     result.totalReservations,
      completedReservations: result.completedReservations,
      currentStreak:         result.currentStreak,
      longestStreak:         result.longestStreak,
      streakBadges:          result.streakBadges,
      milestoneBadges:       result.milestoneBadges,
      scoreUpdatedAt:        new Date(),
    },
    { merge: true }
  );

  return result;
}

// ─────────── Helper compatibilidad ───────────
//
// Algunos archivos antiguos importan getStreakDiscounts(). La función
// queda definida para no romper imports, pero siempre devuelve 0.
// TODO: deprecar y remover los call-sites.
//
// @deprecated Los descuentos económicos por racha fueron eliminados.

export function getStreakDiscounts(_streakPoints: number): {
  shippingDiscount: number;
  commissionDiscount: number;
} {
  return { shippingDiscount: 0, commissionDiscount: 0 };
}