// lib/retailers/calculateScore.ts
//
// Calcula score, nivel, comisión, racha y badges de un retailer
// basado en su historial completo de reservas cerradas.
//
// SCORE FINAL = (velocidadPromedio × 0.5) + (tasaCompletado × 0.5)
//
// Velocidad por reserva:
//   0-12h  → 1.0
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
//   Nivel 1 → 10%
//   Nivel 2 → 11%
//   Nivel 3 → 12%
//   Nivel 4 → 14%
//
// Badges de racha (se pierden si se rompe la racha):
//   3  pagos consecutivos < 12h → "Comprador Inicial"
//   5  pagos consecutivos < 12h → "Comprador Recurrente"
//   10 pagos consecutivos < 12h → "Comprador de Confianza"
//   20 pagos consecutivos < 12h → "Comprador Distingido"
//
// Badges de milestone (permanentes, no se pierden):
//   1  lote pagado  → ""
//   10 lotes pagados → ""
//   25 lotes pagados → ""
//   50 lotes pagados → ""
//
// Descuento milestone:
//   Cada 10 lotes pagados → nextMilestoneDiscount = true
//   Se aplica como 1% extra de descuento en el próximo lote

import { db } from "../firebase-admin";

export type PaymentLevel = 1 | 2 | 3 | 4;

// ── Badges de racha (se pierden al romper la racha) ─────────────
export const STREAK_BADGES: { streak: number; id: string; label: string }[] = [
  { streak: 3,  id: "streak_executive",  label: "Camino al Siguente Nivel"  },
  { streak: 5,  id: "streak_strategic",  label: "Revendedor Consolidado"    },
  { streak: 10, id: "streak_premium",    label: "Racha Activa"     },
  { streak: 20, id: "streak_top",        label: "Elite Privada"    },
];

// ── Badges de milestone (permanentes) ───────────────────────────
export const MILESTONE_BADGES: { lots: number; id: string; label: string }[] = [
  { lots: 1,  id: "milestone_first",      label: "Primer Eslabon"       },
  { lots: 10, id: "milestone_solid",      label: "Revendedor Tallado"   },
  { lots: 25, id: "milestone_operator",   label: "Maestro del Sector"   },
  { lots: 50, id: "milestone_founding",   label: "Socio Fundador de MayoristaMovil"    },
];

export interface RetailerScore {
  score: number;
  level: PaymentLevel;
  commission: number;             // porcentaje a aplicar (10, 11, 12 o 14)
  totalReservations: number;
  completedReservations: number;
  currentStreak: number;          // racha actual de pagos < 12h consecutivos
  longestStreak: number;          // racha histórica más larga (nunca baja)
  streakBadges: string[];         // badges de racha activos (ids)
  milestoneBadges: string[];      // badges de milestone ganados (ids permanentes)
  nextMilestoneDiscount: boolean; // si tiene descuento disponible para el próximo lote
}

// ── Helpers ──────────────────────────────────────────────────────

function speedScore(hoursToPayment: number): number {
  if (hoursToPayment <= 12) return 1.0;
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
    case 1: return 11;
    case 2: return 12;
    case 3: return 13;
    case 4: return 14;
  }
}

function computeStreakBadges(streak: number): string[] {
  return STREAK_BADGES
    .filter((b) => streak >= b.streak)
    .map((b) => b.id);
}

function computeMilestoneBadges(totalPaid: number): string[] {
  return MILESTONE_BADGES
    .filter((b) => totalPaid >= b.lots)
    .map((b) => b.id);
}

// ── Cálculo principal ─────────────────────────────────────────────

export async function calculateRetailerScore(retailerId: string): Promise<RetailerScore> {
  // Leer datos existentes para preservar longestStreak y milestoneBadges
  const existingSnap = await db.collection("retailers").doc(retailerId).get();
  const existing = existingSnap.data() || {};
  const previousLongestStreak: number  = existing.longestStreak ?? 0;
  const previousMilestoneBadges: string[] = existing.milestoneBadges ?? [];
  const previousPaid: number           = existing.completedReservations ?? 0;

  // Traer todas las reservas cerradas
  // Sin orderBy para evitar requerir índice compuesto en Firestore
  // El orden cronológico se aplica en memoria a continuación
  const snap = await db
    .collection("reservations")
    .where("retailerId", "==", retailerId)
    .where("status", "in", ["paid", "cancelled"])
    .get();

  if (snap.empty) {
    return {
      score: 0.6,
      level: 2,
      commission: 11,
      totalReservations: 0,
      completedReservations: 0,
      currentStreak: 0,
      longestStreak: previousLongestStreak,
      streakBadges: [],
      milestoneBadges: previousMilestoneBadges,
      nextMilestoneDiscount: false,
    };
  }

  // Ordenar cronológicamente en memoria por lotClosedAt para calcular rachas correctamente
  const sortedDocs = snap.docs.slice().sort((a, b) => {
    const aMs = a.data().lotClosedAt?.toMillis?.() ?? 0;
    const bMs = b.data().lotClosedAt?.toMillis?.() ?? 0;
    return aMs - bMs;
  });

  let totalSpeed    = 0;
  let speedCount    = 0;
  let paid          = 0;
  let total         = 0;
  let currentStreak = 0;
  let longestStreak = previousLongestStreak;

  for (const doc of sortedDocs) {
    const r = doc.data();
    total++;

    if (r.status === "paid") {
      paid++;

      const closedAt: number = r.lotClosedAt?.toMillis?.() ?? 0;
      const paidAt: number   = r.paidAt?.toMillis?.() ?? 0;

      let hours = 999;
      if (closedAt && paidAt && paidAt > closedAt) {
        hours = (paidAt - closedAt) / (1000 * 60 * 60);
        totalSpeed += speedScore(hours);
        speedCount++;
      } else {
        // Sin timestamps precisos → velocidad media, fuera de racha
        totalSpeed += 0.5;
        speedCount++;
        hours = 24;
      }

      // Racha: solo si pagó en < 12h
      if (hours <= 12) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    } else {
      // cancelled → rompe la racha
      currentStreak = 0;
    }
  }

  const completionRate = total > 0 ? paid / total : 0;
  const speedAvg       = speedCount > 0 ? totalSpeed / speedCount : 0;
  const score          = (speedAvg * 0.5) + (completionRate * 0.5);
  const level          = scoreToLevel(score, total > 0);
  const commission     = levelToCommission(level);

  const streakBadges    = computeStreakBadges(currentStreak);
  const milestoneBadges = computeMilestoneBadges(paid);

  // Descuento milestone: se activa cada vez que paid cruza un múltiplo de 10
  const crossedMilestone = paid > 0 && paid % 10 === 0 && previousPaid < paid;
  // Si ya tenía descuento pendiente sin usar, lo conservamos
  const nextMilestoneDiscount =
    crossedMilestone || (existing.nextMilestoneDiscount === true);

  return {
    score,
    level,
    commission,
    totalReservations: total,
    completedReservations: paid,
    currentStreak,
    longestStreak,
    streakBadges,
    milestoneBadges,
    nextMilestoneDiscount,
  };
}

// ── Guardar en Firestore ──────────────────────────────────────────

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
      nextMilestoneDiscount: result.nextMilestoneDiscount,
      scoreUpdatedAt:        new Date(),
    },
    { merge: true }
  );

  return result;
}

// ── Consumir descuento milestone ──────────────────────────────────
// Llamar desde reserve/route.ts cuando el descuento se aplica al lote

export async function consumeMilestoneDiscount(retailerId: string): Promise<void> {
  await db.collection("retailers").doc(retailerId).set(
    { nextMilestoneDiscount: false },
    { merge: true }
  );
}