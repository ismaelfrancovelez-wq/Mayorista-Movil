// lib/payments/reconciliation.ts
//
// Matcher en cascada para conciliar movimientos bancarios entrantes
// con reservas pendientes de pago por transferencia.
//
// Es lógica pura, sin side effects. Recibe datos, devuelve matches.
// Por eso es fácil de testear y de razonar.
//
// El sistema de matching tiene 5 capas:
//   1. Filtro grueso por fecha (ventana de 48hs)
//   2. Match por monto exacto en centavos
//   3. Desempate por código de referencia (ej "MM-A8K2") en detail
//   4. Desempate por reserva más antigua
//   5. Marcado de ambigüedad para auditoría humana

import type { PrometeoMovement } from "../prometeo";

// ============================================================
// TIPOS
// ============================================================

/**
 * Reserva esperando ser pagada por transferencia.
 * Solo los campos que el matcher necesita (no todo el doc de Firestore).
 */
export interface PendingTransferReservation {
  id: string;
  /** Monto exacto esperado, incluyendo centavos únicos. Ej: 48237.43 */
  expectedAmount: number;
  /** Código de referencia generado al iniciar la transferencia. Ej: "MM-A8K2" */
  referenceCode: string;
  /** Timestamp en ms de cuando el cliente eligió "pagar por transferencia" */
  awaitingSince: number;
}

/**
 * Resultado del matcher para un movimiento bancario.
 */
export type MatchResult =
  | {
      kind: "matched";
      /** ID de la reserva matcheada */
      reservationId: string;
      /** Movimiento que la matcheó */
      movement: PrometeoMovement;
      /** Por qué capa fue matcheada (para logging y debugging) */
      matchedBy: "amount_unique" | "reference_code" | "oldest_first";
      /** Si fue por desempate, los IDs de las otras candidatas (para auditoría) */
      ambiguousAlternatives?: string[];
    }
  | {
      kind: "no_match";
      movement: PrometeoMovement;
      reason: "outside_window" | "no_amount_match" | "is_debit";
    };

export interface ReconciliationOutput {
  /** Matches confirmados, listos para llamar a confirmReservationPayment */
  matches: Extract<MatchResult, { kind: "matched" }>[];
  /** Movimientos sin match, para logging */
  noMatches: Extract<MatchResult, { kind: "no_match" }>[];
  /** Reservas que quedaron sin matchear, para reporting */
  unmatchedReservations: PendingTransferReservation[];
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

/** Cuántas horas hacia atrás mira el matcher. */
export const RECONCILIATION_WINDOW_HOURS = 48;

// ============================================================
// MATCHER PRINCIPAL
// ============================================================

/**
 * Reconcilia movimientos bancarios contra reservas pendientes.
 *
 * Importante: este matcher NO modifica nada. Solo decide qué con qué.
 * Es responsabilidad del caller llamar a confirmReservationPayment()
 * con los matches devueltos.
 */
export function reconcileMovements(args: {
  movements: PrometeoMovement[];
  reservations: PendingTransferReservation[];
  /** Para tests, permite pasar un "now" determinístico */
  now?: number;
}): ReconciliationOutput {
  const now = args.now ?? Date.now();
  const windowStart = now - RECONCILIATION_WINDOW_HOURS * 60 * 60 * 1000;

  // Trabajaremos con un set mutable de reservas todavía no matcheadas
  const unmatched = new Map<string, PendingTransferReservation>();
  args.reservations.forEach((r) => unmatched.set(r.id, r));

  const matches: Extract<MatchResult, { kind: "matched" }>[] = [];
  const noMatches: Extract<MatchResult, { kind: "no_match" }>[] = [];

  for (const movement of args.movements) {
    // ────────────────────────────────────────
    // CAPA 1 — Solo ingresos (credit > 0), filtrar débitos
    // ────────────────────────────────────────
    if (!isCredit(movement)) {
      noMatches.push({ kind: "no_match", movement, reason: "is_debit" });
      continue;
    }

    // ────────────────────────────────────────
    // CAPA 1b — Filtro temporal (últimas 48hs)
    // ────────────────────────────────────────
    const movementTime = parseMovementDate(movement.date);
    if (movementTime !== null && movementTime < windowStart) {
      noMatches.push({ kind: "no_match", movement, reason: "outside_window" });
      continue;
    }

    // ────────────────────────────────────────
    // CAPA 2 — Match por monto exacto en centavos
    // ────────────────────────────────────────
    const candidates = findReservationsByExactAmount(
      Array.from(unmatched.values()),
      movement.credit
    );

    if (candidates.length === 0) {
      noMatches.push({ kind: "no_match", movement, reason: "no_amount_match" });
      continue;
    }

    if (candidates.length === 1) {
      // Caso ideal: un único match por monto único
      const r = candidates[0];
      matches.push({
        kind: "matched",
        reservationId: r.id,
        movement,
        matchedBy: "amount_unique",
      });
      unmatched.delete(r.id);
      continue;
    }

    // ────────────────────────────────────────
    // CAPA 3 — Hay múltiples candidatas, intentar por código de referencia
    // ────────────────────────────────────────
    const detailUpper = (movement.detail || "").toUpperCase();
    const byReference = candidates.find((r) =>
      detailUpper.includes(r.referenceCode.toUpperCase())
    );

    if (byReference) {
      const others = candidates.filter((c) => c.id !== byReference.id).map((c) => c.id);
      matches.push({
        kind: "matched",
        reservationId: byReference.id,
        movement,
        matchedBy: "reference_code",
        ambiguousAlternatives: others,
      });
      unmatched.delete(byReference.id);
      continue;
    }

    // ────────────────────────────────────────
    // CAPA 4 — Desempate por reserva más antigua (FIFO)
    // ────────────────────────────────────────
    const oldest = candidates.reduce((a, b) =>
      a.awaitingSince <= b.awaitingSince ? a : b
    );
    const others = candidates.filter((c) => c.id !== oldest.id).map((c) => c.id);

    matches.push({
      kind: "matched",
      reservationId: oldest.id,
      movement,
      matchedBy: "oldest_first",
      ambiguousAlternatives: others,
    });
    unmatched.delete(oldest.id);
  }

  return {
    matches,
    noMatches,
    unmatchedReservations: Array.from(unmatched.values()),
  };
}

// ============================================================
// HELPERS
// ============================================================

function isCredit(movement: PrometeoMovement): boolean {
  // Prometeo a veces devuelve "" (string vacío), null o un número.
  const credit = typeof movement.credit === "number" ? movement.credit : 0;
  return credit > 0;
}

/**
 * Comparación exacta en centavos. Convierte a entero (centavos) para
 * evitar comparaciones flotantes (0.1 + 0.2 ≠ 0.3 y todo eso).
 */
function findReservationsByExactAmount(
  reservations: PendingTransferReservation[],
  movementAmount: number
): PendingTransferReservation[] {
  const movementCents = Math.round(movementAmount * 100);
  return reservations.filter((r) => {
    const reservationCents = Math.round(r.expectedAmount * 100);
    return reservationCents === movementCents;
  });
}

/**
 * Parsea las fechas que devuelve Prometeo.
 * Probamos formato "DD/MM/YYYY" (que es lo que vemos en provider=test).
 * Si no se puede parsear, devolvemos null y el filtro temporal se saltea
 * (mejor matchear de más que de menos).
 */
function parseMovementDate(dateStr: string): number | null {
  if (!dateStr) return null;

  // Formato DD/MM/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const m = dateStr.match(ddmmyyyy);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    return new Date(year, month - 1, day).getTime();
  }

  // Fallback: intentar Date.parse (formato ISO, etc)
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}

// ============================================================
// HELPER PÚBLICO: generar centavos únicos
// ============================================================

/**
 * Dado un monto base, devuelve un monto con centavos aleatorios entre 1 y 99.
 *
 * Ej: applyUniqueCents(48237) → 48237.43 (random)
 *
 * IMPORTANTE: el caller debe verificar que el monto resultante no colisiona
 * con otra reserva pendiente del mismo cliente o del mismo día. En la práctica,
 * con 99 centavos posibles y volúmenes razonables, las colisiones son raras,
 * pero conviene re-tirar el random hasta encontrar uno libre.
 */
export function applyUniqueCents(baseAmount: number): number {
  const baseCents = Math.round(baseAmount * 100);
  // Quitar centavos que pudiera tener el monto base
  const baseInteger = Math.floor(baseCents / 100) * 100;
  // Sumar 1-99 centavos
  const randomCents = 1 + Math.floor(Math.random() * 99);
  return (baseInteger + randomCents) / 100;
}

// ============================================================
// HELPER PÚBLICO: generar código de referencia corto
// ============================================================

/**
 * Genera un código tipo "MM-A8K2" (4 caracteres alfanuméricos).
 * Caracteres ambiguos eliminados: 0/O, 1/I/L.
 *
 * 32^4 = 1.048.576 combinaciones. Para tu volumen, las colisiones
 * son rarísimas. Aún así, el caller debería verificar unicidad
 * en Firestore antes de persistirlo.
 */
export function generateReferenceCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "MM-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}