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
//   Nivel 1 → 11%
//   Nivel 2 → 12%
//   Nivel 3 → 13%
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
  { streak: 3,  id: "streak_executive",  label: "Camino al Exito"  },
  { streak: 5,  id: "streak_strategic",  label: "Revendedor Consolidado"    },
  { streak: 10, id: "streak_premium",    label: "Racha Activa"     },
  { streak: 20, id: "streak_top",        label: "Elite Privada"    },
];

// ── Badges de milestone (permanentes) ───────────────────────────
export const MILESTONE_BADGES: { lots: number; id: string; label: string }[] = [
  { lots: 1,  id: "milestone_first",      label: "Primer Vinculo"       },
  { lots: 10, id: "milestone_solid",      label: "Revendedor Tallado"   },
  { lots: 25, id: "milestone_operator",   label: "Maestro del Sector"   },
  { lots: 50, id: "milestone_founding",   label: "Socio Fundador de MayoristaMovil"    },
];

export interface RetailerScore {
  score: number;
  level: PaymentLevel;
  commission: number;             // porcentaje a aplicar (11, 12, 13 o 14)
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
//
// ARQUITECTURA INCREMENTAL (Bug 2 fix):
//
// En vez de leer TODAS las reservas del usuario en cada pago
// (costoso: 200 lecturas para usuario con 200 lotes),
// guardamos un agregado pre-computado en retailers/<id>.scoreAggregate:
//
//   {
//     totalReservations: number,     // total procesadas
//     completedReservations: number, // pagadas
//     totalSpeedSum: number,         // suma de speedScore de cada pago
//     speedCount: number,            // cantidad con timestamps válidos
//     currentStreak: number,
//     longestStreak: number,
//   }
//
// updateRetailerScoreIncremental (llamada desde el webhook) recibe el
// paidAt y lotClosedAt de la reserva recién pagada y actualiza el
// agregado con UNA sola lectura + UNA escritura.
//
// calculateRetailerScore (full recalc) se mantiene para:
//   - Reconstruir el agregado si no existe (migración / primer uso)
//   - Recálculos manuales / admin

export async function calculateRetailerScore(retailerId: string): Promise<RetailerScore> {
  // Leer datos existentes para preservar longestStreak y milestoneBadges
  const existingSnap = await db.collection("retailers").doc(retailerId).get();
  const existing = existingSnap.data() || {};
  const previousLongestStreak: number     = existing.longestStreak ?? 0;
  const previousMilestoneBadges: string[] = existing.milestoneBadges ?? [];
  const previousPaid: number              = existing.completedReservations ?? 0;

  // Traer todas las reservas cerradas (full recalc — solo se usa en migración o admin)
  const snap = await db
    .collection("reservations")
    .where("retailerId", "==", retailerId)
    .where("status", "in", ["paid", "cancelled"])
    .get();

  if (snap.empty) {
    return {
      score: 0.6,
      level: 2,
      commission: 12,  // nivel 2 = 12% (consistente con levelToCommission)
      totalReservations: 0,
      completedReservations: 0,
      currentStreak: 0,
      longestStreak: previousLongestStreak,
      streakBadges: [],
      milestoneBadges: previousMilestoneBadges,
      nextMilestoneDiscount: false,
    };
  }

  // Ordenar cronológicamente en memoria por lotClosedAt para calcular rachas
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

      if (hours <= 12) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    } else {
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

  const crossedMilestone = paid > 0 && paid % 10 === 0 && previousPaid < paid;
  const nextMilestoneDiscount =
    crossedMilestone || (existing.nextMilestoneDiscount === true);

  // ✅ Reconstruir el agregado en Firestore para que los próximos pagos
  // puedan usar el camino incremental (sin leer todas las reservas)
  await db.collection("retailers").doc(retailerId).set(
    {
      scoreAggregate: {
        totalReservations: total,
        completedReservations: paid,
        totalSpeedSum: totalSpeed,
        speedCount,
        currentStreak,
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
    currentStreak,
    longestStreak,
    streakBadges,
    milestoneBadges,
    nextMilestoneDiscount,
  };
}

// ── Actualización incremental (llamada desde el webhook) ──────────
//
// Recibe los datos de la reserva recién pagada y actualiza el agregado
// con UNA sola lectura de Firestore (el doc del retailer) + UNA escritura.
// Para usuarios con 200 lotes: costo = 2 operaciones (vs 200 antes).
//
// Parámetros:
//   retailerId   — id del retailer
//   paidAt       — timestamp en ms del pago (Date.now() o webhook timestamp)
//   lotClosedAt  — timestamp en ms del cierre del lote
//   wasCancelled — si la reserva fue cancelada (rompe racha, no suma paid)

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

  // Si no hay agregado previo → hacer full recalc para construirlo,
  // luego volver a leer el agregado ya construido
  if (!agg || typeof agg.totalReservations !== "number") {
    console.log(`[score] No hay agregado para ${retailerId} → full recalc`);
    return updateRetailerScore(retailerId);
  }

  // ── Calcular speed de este pago ─────────────────────────────────
  let hours = 999;
  let speed = 0.5; // fallback si no hay timestamps
  if (lotClosedAt > 0 && paidAt > lotClosedAt) {
    hours = (paidAt - lotClosedAt) / (1000 * 60 * 60);
    speed = speedScore(hours);
  }

  // ── Actualizar agregado ─────────────────────────────────────────
  const prevTotal         = agg.totalReservations;
  const prevPaid          = agg.completedReservations;
  const prevSpeedSum      = agg.totalSpeedSum ?? 0;
  const prevSpeedCount    = agg.speedCount ?? 0;
  const prevStreak        = agg.currentStreak ?? 0;
  const prevLongest       = agg.longestStreak ?? (existing.longestStreak ?? 0);
  const previousPaid      = existing.completedReservations ?? prevPaid;

  const newTotal      = prevTotal + 1;
  const newPaid       = wasCancelled ? prevPaid : prevPaid + 1;
  const newSpeedSum   = wasCancelled ? prevSpeedSum : prevSpeedSum + speed;
  const newSpeedCount = wasCancelled ? prevSpeedCount : prevSpeedCount + 1;

  let newStreak  = wasCancelled ? 0 : (hours <= 12 ? prevStreak + 1 : 0);
  let newLongest = Math.max(prevLongest, newStreak);

  // ── Recalcular score con el agregado actualizado ────────────────
  const completionRate = newTotal > 0 ? newPaid / newTotal : 0;
  const speedAvg       = newSpeedCount > 0 ? newSpeedSum / newSpeedCount : 0;
  const score          = (speedAvg * 0.5) + (completionRate * 0.5);
  const level          = scoreToLevel(score, newTotal > 0);
  const commission     = levelToCommission(level);

  const streakBadges    = computeStreakBadges(newStreak);
  const milestoneBadges = computeMilestoneBadges(newPaid);

  // Preservar milestones permanentes ya ganados
  const existingMilestones: string[] = existing.milestoneBadges ?? [];
  const mergedMilestones = Array.from(new Set([...existingMilestones, ...milestoneBadges]));

  const crossedMilestone = newPaid > 0 && newPaid % 10 === 0 && previousPaid < newPaid;
  const nextMilestoneDiscount =
    crossedMilestone || (existing.nextMilestoneDiscount === true);

  // ── Escribir en Firestore (una sola operación) ──────────────────
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
      nextMilestoneDiscount,
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
    currentStreak:   newStreak,
    longestStreak:   newLongest,
    streakBadges,
    milestoneBadges: mergedMilestones,
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