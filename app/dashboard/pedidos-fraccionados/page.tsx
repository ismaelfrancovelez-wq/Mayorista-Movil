// app/dashboard/pedidos-fraccionados/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// DECISIONES DE DISEÑO — BASE CIENTÍFICA
//
// 1. JERARQUÍA F-PATTERN (Nielsen Norman Group eye-tracking):
//    CTAs de pago en zona superior-izquierda de cada card. Alto contraste.
//
// 2. AVERSIÓN A LA PÉRDIDA (Kahneman & Tversky, 1979):
//    Racha y nivel muestran qué se PIERDE, no solo qué se gana.
//    Microcopy: "No pierdas tu racha" > "Mantené tu racha".
//
// 3. EFECTO ENDOWMENT — PROGRESO PRECARGADO (Nunes & Drèze, 2006):
//    Barras de progreso arrancan visualmente cargadas. "+82% completion rate".
//    KPIs muestran acumulado histórico como ancla de valor.
//
// 4. LEY DE MILLER — CARGA COGNITIVA:
//    Máx 3 acciones posibles por sección visible. Agrupación semántica.
//
// 5. COLOR SEMÁNTICO (CXL Institute):
//    Azul → confianza/B2B. Naranja → urgencia suave (CTAs secundarios).
//    Verde → éxito/progreso completado. Rojo → solo pérdida real.
//    Ámbar → nivel premium / recompensa.
//
// 6. SOCIAL PROOF INLINE (Cialdini, Influence 1984):
//    "X compradores ya en este lote" en cada lote activo.
//    Activa instinto de rebaño y valida la decisión de compra.
//
// 7. URGENCIA LEGÍTIMA (Urgency vs Scarcity, ConversionXL):
//    Countdown de 12hs solo cuando el lote realmente está cerrado.
//    Falsa urgencia destruye confianza en B2B.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import UserRoleHeader from "../../../components/UserRoleHeader";
import Link from "next/link";
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react";
import { DashboardSkeleton } from "../../../components/DashboardSkeleton";
import CancelReservationButton from "../../../components/CancelReservationButton";
import HideOrderButton from "../../../components/HideOrderButton";

export const dynamic = "force-dynamic";
export const revalidate = 10;

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type ActiveLot = {
  id: string;
  reservationDocId?: string;
  productId: string;
  productName: string;
  type: string;
  accumulatedQty: number;
  minimumOrder: number;
  userQty: number;
  progress: number;
  userPayments: number;
  isReservation: boolean;
  isPendingLot: boolean;
  lotClosed: boolean;
  paymentLink?: string;
  totalFinal?: number;
  buyerCount?: number; // para social proof
};

// ─── CONFIG GAMIFICACIÓN ─────────────────────────────────────────────────────
const NIVELES = [
  { nivel: 1, scoreMin: 0.75, comision: 11, label: "Nivel 1 · Élite",    colorAccent: "#D97706", bgClass: "bg-amber-50",   borderClass: "border-amber-300", textClass: "text-amber-800",  pillClass: "bg-amber-100 text-amber-800",  barClass: "bg-amber-400",  desc: "Ventana exclusiva 2hs + mejor precio de envío" },
  { nivel: 2, scoreMin: 0.50, comision: 12, label: "Nivel 2 · Activo",   colorAccent: "#2563EB", bgClass: "bg-blue-50",    borderClass: "border-blue-200",  textClass: "text-blue-700",   pillClass: "bg-blue-100 text-blue-800",    barClass: "bg-blue-500",   desc: "Acceso a todos los lotes abiertos" },
  { nivel: 3, scoreMin: 0.25, comision: 13, label: "Nivel 3 · Estándar", colorAccent: "#6B7280", bgClass: "bg-gray-50",    borderClass: "border-gray-200",  textClass: "text-gray-600",   pillClass: "bg-gray-100 text-gray-700",    barClass: "bg-gray-400",   desc: "Lotes con menos del 80% completado" },
  { nivel: 4, scoreMin: 0,    comision: 14, label: "Nivel 4 · Nuevo",    colorAccent: "#9CA3AF", bgClass: "bg-gray-50",    borderClass: "border-gray-200",  textClass: "text-gray-500",   pillClass: "bg-gray-100 text-gray-600",    barClass: "bg-gray-300",   desc: "Lotes con menos del 80% completado" },
];

const BADGES_RACHA = [
  { emoji: "🔥", nombre: "Comprador en Llamas",  pagos: 3,  beneficio: "+0.05 al score ese mes" },
  { emoji: "⚡", nombre: "Velocidad Mayorista",   pagos: 5,  beneficio: "Acceso anticipado 1hs a lotes nuevos" },
  { emoji: "💼", nombre: "Máquina de Cupos",      pagos: 10, beneficio: "1 Racha Freeze — fallás una vez sin perder nada" },
  { emoji: "💎", nombre: "Leyenda del Lote",      pagos: 20, beneficio: "Comisión −0.5% mientras mantengas la racha" },
];

const BADGES_PERM = [
  { emoji: "🥉", nombre: "Primer Eslabón",    lotes: 1,  beneficio: "Acceso a fábricas premium" },
  { emoji: "🥈", nombre: "Revendedor Tallado", lotes: 10, beneficio: "Prioridad de cupo en lotes" },
  { emoji: "🥇", nombre: "Maestro del Sector", lotes: 25, beneficio: "Comisión 11% sin importar nivel" },
  { emoji: "💎", nombre: "Socio Fundador",      lotes: 50, beneficio: "Comisión 10% + canal privado" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getNivel(score: number) {
  return NIVELES.find((n) => score >= n.scoreMin) ?? NIVELES[3];
}
function getProgresoNivel(score: number) {
  const actual   = getNivel(score);
  const siguiente = NIVELES[actual.nivel - 2];
  if (!siguiente) return { pct: 100, falta: "0", labelSig: null, comisionSig: null };
  const rango  = siguiente.scoreMin - actual.scoreMin;
  const avance = score - actual.scoreMin;
  return {
    pct:        Math.min(100, Math.round((avance / rango) * 100)),
    falta:      (siguiente.scoreMin - score).toFixed(2),
    labelSig:   `Nivel ${siguiente.nivel}`,
    comisionSig: siguiente.comision,
  };
}

// ─── COMPONENTES ATÓMICOS ─────────────────────────────────────────────────────

/** Barra de progreso con soporte para color personalizado y etiqueta */
function Bar({
  pct,
  colorClass,
  height = "h-2.5",
}: {
  pct: number;
  colorClass: string;
  height?: string;
}) {
  return (
    <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full transition-all duration-700 ${colorClass}`}
        style={{ width: `${Math.max(4, pct)}%` }}
      />
    </div>
  );
}

/** Pill de estado */
function Pill({
  children,
  variant = "gray",
}: {
  children: React.ReactNode;
  variant?: "gray" | "blue" | "orange" | "green" | "amber" | "red";
}) {
  const styles = {
    gray:   "bg-gray-100 text-gray-600",
    blue:   "bg-blue-100 text-blue-700",
    orange: "bg-orange-100 text-orange-700",
    green:  "bg-green-100 text-green-700",
    amber:  "bg-amber-100 text-amber-800",
    red:    "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}

/** Caja de alerta inline */
function AlertBox({
  icon,
  children,
  variant = "blue",
}: {
  icon: string;
  children: React.ReactNode;
  variant?: "blue" | "amber" | "red" | "green" | "orange";
}) {
  const styles = {
    blue:   "bg-blue-50 border-blue-200 text-blue-800",
    amber:  "bg-amber-50 border-amber-200 text-amber-800",
    red:    "bg-red-50 border-red-200 text-red-800",
    green:  "bg-green-50 border-green-200 text-green-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
  };
  return (
    <div className={`flex items-start gap-2.5 border rounded-xl px-3.5 py-3 text-xs ${styles[variant]}`}>
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

// ─── PANEL: NIVEL Y SCORE ─────────────────────────────────────────────────────
// BASE CIENTÍFICA:
// - Ancla de valor: muestra el ahorro en pesos (no %) para que sea concreto (Ariely, Predictably Irrational)
// - Progreso endowment: barra arranca cargada visualmente desde el mínimo del nivel
// - Microcopy de aversión a pérdida: "Si tu score baja de X, perdés..."
function PanelNivel({ score, compraTotal }: { score: number; compraTotal: number }) {
  const nivel   = getNivel(score);
  const prog    = getProgresoNivel(score);
  // Ahorro concreto en pesos vs comisión de Nivel 4 (ancla de valor real)
  const ahorroPesos = Math.round(compraTotal * ((14 - nivel.comision) / 100));
  const ahorroSiSubiera = prog.comisionSig
    ? Math.round(compraTotal * ((nivel.comision - prog.comisionSig) / 100))
    : 0;

  return (
    <div className={`rounded-2xl border-2 ${nivel.borderClass} ${nivel.bgClass} p-5 flex flex-col gap-4`}>
      {/* Header del nivel */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Tu nivel
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${nivel.pillClass}`}>
          {nivel.comision}% comisión
        </span>
      </div>

      {/* Nivel actual */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 shadow-sm"
          style={{ background: nivel.colorAccent + "18", border: `2px solid ${nivel.colorAccent}40` }}
        >
          <span style={{ color: nivel.colorAccent }}>{nivel.nivel}</span>
        </div>
        <div>
          <div className="text-base font-bold text-gray-900 leading-tight">{nivel.label}</div>
          <div className="text-xs text-gray-500 mt-0.5 leading-snug">{nivel.desc}</div>
        </div>
      </div>

      {/* Score + barra */}
      <div>
        <div className="flex justify-between text-xs mb-2">
          <span className="text-gray-500">
            Score: <strong className="text-gray-800 font-bold">{score.toFixed(2)}</strong>
          </span>
          {prog.labelSig && (
            <span className={`font-semibold ${nivel.textClass}`}>
              {prog.falta} pts para {prog.labelSig}
            </span>
          )}
        </div>
        <Bar pct={prog.pct} colorClass={nivel.barClass} height="h-3" />
      </div>

      {/* Ancla de valor — ahorro real en pesos */}
      {ahorroPesos > 0 && (
        <div
          className="rounded-xl px-3.5 py-3 text-xs"
          style={{ background: nivel.colorAccent + "12", border: `1px solid ${nivel.colorAccent}30` }}
        >
          <span className="text-gray-600">
            Con tu nivel actual ya ahorrás{" "}
            <strong style={{ color: nivel.colorAccent }} className="text-sm">
              {formatCurrency(ahorroPesos)}
            </strong>{" "}
            vs el nivel base.
          </span>
          {ahorroSiSubiera > 0 && (
            <span className="block mt-1 text-gray-500">
              Subir al {prog.labelSig} te daría{" "}
              <strong className="text-gray-700">{formatCurrency(ahorroSiSubiera)} más</strong>.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PANEL: RACHA ─────────────────────────────────────────────────────────────
// BASE CIENTÍFICA:
// - Aversión a pérdida: el warning de 12hs está en rojo, no naranja (pérdida real)
// - Efecto Zeigarnik: mostrar tarea incompleta genera más tensión que tarea completa
//   → "1 pago más" es más motivador que mostrar el badge ya ganado
// - Variable ratio reinforcement (Skinner): la grilla muestra los próximos premios
//   para mantener la anticipación activa
function PanelRacha({ currentStreak }: { currentStreak: number }) {
  const siguiente = BADGES_RACHA.find((b) => currentStreak < b.pagos);
  const actual    = [...BADGES_RACHA].reverse().find((b) => currentStreak >= b.pagos);
  const pctSig    = siguiente ? Math.round((currentStreak / siguiente.pagos) * 100) : 100;
  const faltanSig = siguiente ? siguiente.pagos - currentStreak : 0;

  return (
    <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Racha de pagos
        </span>
        {actual && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
            {actual.emoji} {actual.nombre}
          </span>
        )}
      </div>

      {/* Contador */}
      <div className="flex items-center gap-4">
        <div className="text-5xl leading-none select-none">🔥</div>
        <div>
          <div className="text-4xl font-black text-gray-900 leading-none tabular-nums">
            {currentStreak}
          </div>
          <div className="text-xs text-gray-500 mt-1">pagos consecutivos en &lt;12hs</div>
        </div>
      </div>

      {/* Progreso hacia siguiente — Zeigarnik: tarea incompleta */}
      {siguiente && (
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="font-semibold text-orange-700">
              {faltanSig === 1
                ? `¡Solo 1 pago más para ${siguiente.emoji} ${siguiente.nombre}!`
                : `${faltanSig} pagos más → ${siguiente.emoji} ${siguiente.nombre}`}
            </span>
          </div>
          <Bar pct={pctSig} colorClass="bg-orange-400" height="h-3" />
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            {siguiente.beneficio}
          </p>
        </div>
      )}

      {/* Grilla de badges — variable ratio (Skinner) */}
      <div className="grid grid-cols-2 gap-2">
        {BADGES_RACHA.map((b) => {
          const ganado = currentStreak >= b.pagos;
          return (
            <div
              key={b.pagos}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border text-xs transition-all ${
                ganado
                  ? "bg-white border-orange-300 shadow-sm"
                  : "bg-white/40 border-orange-100 opacity-50"
              }`}
            >
              <span className={`text-xl shrink-0 ${!ganado ? "grayscale" : ""}`}>
                {b.emoji}
              </span>
              <div className="min-w-0">
                <div className={`font-semibold truncate leading-tight ${ganado ? "text-gray-800" : "text-gray-400"}`}>
                  {b.nombre}
                </div>
                <div className="text-gray-400 text-[10px]">{b.pagos} pagos</div>
              </div>
              {ganado && <span className="ml-auto text-green-500 text-base shrink-0">✓</span>}
            </div>
          );
        })}
      </div>

      {/* Aversión a pérdida — rojo porque ES una pérdida real */}
      <AlertBox icon="⏰" variant="red">
        Tenés <strong>12hs</strong> desde el cierre del lote para pagar.
        Si no pagás a tiempo, <strong>perdés toda tu racha</strong>.
      </AlertBox>
    </div>
  );
}

// ─── PANEL: BADGES PERMANENTES ────────────────────────────────────────────────
// BASE CIENTÍFICA:
// - Identidad social (Tajfel & Turner): los badges crean categorías de pertenencia.
//   "Socio Fundador" es identidad, no solo premio.
// - Endowment effect: mostrar lotes ya acumulados refuerza el sunk cost positivo
//   → el usuario no quiere "desperdiciar" su historial yéndose.
// - Progreso: barra arranca desde lotes actuales / lotes del siguiente badge
function PanelBadgesPermanentes({ lotesTotal }: { lotesTotal: number }) {
  const siguiente = BADGES_PERM.find((b) => lotesTotal < b.lotes);
  const pctSig    = siguiente ? Math.round((lotesTotal / siguiente.lotes) * 100) : 100;

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Logros permanentes
        </span>
        <span className="text-xs text-gray-400 font-medium">nunca se pierden</span>
      </div>

      {/* Contador de lotes — endowment effect */}
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black text-gray-900 tabular-nums">{lotesTotal}</span>
        <span className="text-sm text-gray-500 font-medium">lotes completados</span>
      </div>

      {/* Progreso hacia siguiente badge */}
      {siguiente && (
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="font-semibold text-blue-700">
              {siguiente.lotes - lotesTotal === 1
                ? `¡1 lote más para ${siguiente.emoji} ${siguiente.nombre}!`
                : `${siguiente.lotes - lotesTotal} lotes más → ${siguiente.emoji} ${siguiente.nombre}`}
            </span>
          </div>
          <Bar pct={pctSig} colorClass="bg-blue-500" height="h-3" />
          <p className="text-xs text-gray-500 mt-1.5">{siguiente.beneficio}</p>
        </div>
      )}

      {/* Lista de badges — identidad social */}
      <div className="flex flex-col gap-2">
        {BADGES_PERM.map((b) => {
          const ganado = lotesTotal >= b.lotes;
          return (
            <div
              key={b.lotes}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 border transition-all ${
                ganado
                  ? "bg-white border-blue-200 shadow-sm"
                  : "bg-white/40 border-blue-100 opacity-40"
              }`}
            >
              <span className={`text-2xl shrink-0 ${!ganado ? "grayscale" : ""}`}>{b.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold leading-tight ${ganado ? "text-gray-900" : "text-gray-400"}`}>
                  {b.nombre}
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{b.beneficio}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-bold ${ganado ? "text-blue-600" : "text-gray-300"}`}>
                  {b.lotes} lotes
                </div>
                {ganado && <div className="text-[10px] text-green-500 font-bold mt-0.5">✓ OBTENIDO</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CONTENIDO PRINCIPAL ──────────────────────────────────────────────────────
async function DashboardRevendedorContent() {
  const userId = cookies().get("userId")?.value;
  const role   = cookies().get("activeRole")?.value;

  if (!userId || role !== "retailer") {
    return <div className="p-6 text-gray-500">No autorizado</div>;
  }

  /* ── 1. CONSULTAS PARALELAS ── */
  const [ordersSnap, reservationsSnap, userSnap, retailerSnap] = await Promise.all([
    db.collection("payments").where("buyerId", "==", userId).limit(100).get(),
    db.collection("reservations")
      .where("retailerId", "==", userId)
      .where("status", "in", ["pending_lot", "lot_closed", "paid"])
      .limit(100)
      .get(),
    db.collection("users").doc(userId).get(),
    db.collection("retailers").doc(userId).get(),
  ]);

  const orders       = ordersSnap.docs.map((d) => d.data());
  const reservations = reservationsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  const hiddenIds: string[] = userSnap.data()?.hiddenOrders || [];
  const userEmail  = cookies().get("userEmail")?.value  || userSnap.data()?.email || "";
  const userName   = cookies().get("userName")?.value   || userSnap.data()?.name  || userEmail.split("@")[0] || "revendedor";

  const retailerData          = retailerSnap.data() || {};
  const milestoneBadges: string[] = retailerData.milestoneBadges ?? [];
  const streakBadges: string[]    = retailerData.streakBadges    ?? [];
  const currentStreak: number     = retailerData.currentStreak   ?? 0;
  const score: number             = retailerData.score           ?? 0.5;
  const lotesCompletados: number  = retailerData.lotesCompletados ?? 0;

  /* ── 2. ESTADO REAL DE LOTES ── */
  const allLotIds = new Set<string>();
  orders.forEach((o) => { if (o.lotId) allLotIds.add(o.lotId); });
  reservations.forEach((r) => { if (r.lotId) allLotIds.add(r.lotId); });

  const lotsRealStatus = new Map<string, {
    status: string; accumulatedQty: number; minimumOrder: number;
    type: string; productId: string; buyerCount?: number;
  }>();

  if (allLotIds.size > 0) {
    const arr = Array.from(allLotIds);
    for (let i = 0; i < arr.length; i += 10) {
      const snap = await db.collection("lots").where("__name__", "in", arr.slice(i, i + 10)).get();
      snap.docs.forEach((d) => {
        lotsRealStatus.set(d.id, {
          status:         d.data().status,
          accumulatedQty: d.data().accumulatedQty  || 0,
          minimumOrder:   d.data().minimumOrder     || d.data().MF || 0,
          type:           d.data().type,
          productId:      d.data().productId,
          buyerCount:     d.data().buyerCount       || 0, // ← social proof
        });
      });
    }
  }

  /* ── 3. KPIs ── */
  const directOrders = orders.filter((o) => o.orderType === "directa");

  const fullyPaidLotIds = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotId &&
        lotsRealStatus.get(o.lotId)?.status === "fully_paid")
      fullyPaidLotIds.add(o.lotId);
  });
  reservations.forEach((r) => {
    if (r.status === "paid" && r.lotId &&
        lotsRealStatus.get(r.lotId)?.status === "fully_paid")
      fullyPaidLotIds.add(r.lotId);
  });

  const pedidosTotalesCount = directOrders.length + fullyPaidLotIds.size;

  const activeFractionalLots = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotId) {
      const s = lotsRealStatus.get(o.lotId)?.status;
      if (s && s !== "fully_paid") activeFractionalLots.add(o.lotId);
    }
  });
  const activeReservationLots = new Set<string>();
  reservations.forEach((r) => {
    if ((r.status === "pending_lot" || r.status === "lot_closed") && r.lotId)
      activeReservationLots.add(r.lotId);
  });

  const pedidosEnProcesoCount = activeFractionalLots.size + activeReservationLots.size;

  const totalInvertido =
    orders
      .filter((o) => {
        if (o.orderType === "directa") return true;
        if (o.orderType === "fraccionado" && o.lotId)
          return lotsRealStatus.get(o.lotId)?.status === "fully_paid";
        return false;
      })
      .reduce((acc, o) => acc + (o.total || 0), 0) +
    reservations
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + (r.totalFinal || 0), 0);

  /* ── 4 & 5. LOTES EN CURSO ── */
  const lotMapFromPayments = new Map<string, {
    lotId: string; productId: string; productName: string; totalQty: number; payments: number;
  }>();

  orders
    .filter((o) => {
      if (o.orderType !== "fraccionado" || !o.lotId) return false;
      const s = lotsRealStatus.get(o.lotId)?.status;
      return s && s !== "fully_paid";
    })
    .forEach((p) => {
      const lotId = p.lotId;
      if (lotMapFromPayments.has(lotId)) {
        const e = lotMapFromPayments.get(lotId)!;
        e.totalQty += p.qty || 0;
        e.payments += 1;
      } else {
        lotMapFromPayments.set(lotId, {
          lotId, productId: p.productId,
          productName: p.productName || "Producto",
          totalQty: p.qty || 0, payments: 1,
        });
      }
    });

  const lotMapFromReservations = new Map<string, {
    lotId: string; reservationDocId: string; productId: string; productName: string;
    totalQty: number; status: string; paymentLink?: string; totalFinal?: number;
  }>();

  reservations
    .filter((r) => r.status === "pending_lot" || r.status === "lot_closed")
    .forEach((r) => {
      if (!r.lotId || lotMapFromPayments.has(r.lotId)) return;
      if (lotMapFromReservations.has(r.lotId)) {
        lotMapFromReservations.get(r.lotId)!.totalQty += r.qty || 0;
      } else {
        lotMapFromReservations.set(r.lotId, {
          lotId: r.lotId, reservationDocId: r.id,
          productId: r.productId, productName: r.productName || "Producto",
          totalQty: r.qty || 0, status: r.status,
          paymentLink: r.paymentLink || null, totalFinal: r.totalFinal || null,
        });
      }
    });

  const activeLots: ActiveLot[] = [];

  for (const [lotId, ui] of lotMapFromPayments.entries()) {
    const listId  = lotId;
    if (hiddenIds.includes(listId)) continue;
    const lotReal = lotsRealStatus.get(lotId);
    if (!lotReal) continue;
    activeLots.push({
      id: listId, productId: lotReal.productId || ui.productId,
      productName: ui.productName, type: lotReal.type,
      accumulatedQty: lotReal.accumulatedQty, minimumOrder: lotReal.minimumOrder,
      userQty: ui.totalQty, userPayments: ui.payments,
      progress: lotReal.minimumOrder > 0
        ? Math.min((lotReal.accumulatedQty / lotReal.minimumOrder) * 100, 100) : 0,
      isReservation: false, isPendingLot: false,
      lotClosed: lotReal.status === "closed", buyerCount: lotReal.buyerCount,
    });
  }

  for (const [lotId, ui] of lotMapFromReservations.entries()) {
    const listId  = `reservation-${lotId}`;
    if (hiddenIds.includes(listId)) continue;
    const lotReal = lotsRealStatus.get(lotId);
    if (!lotReal) continue;
    activeLots.push({
      id: listId, reservationDocId: ui.reservationDocId,
      productId: lotReal.productId || ui.productId,
      productName: ui.productName, type: lotReal.type,
      accumulatedQty: lotReal.accumulatedQty, minimumOrder: lotReal.minimumOrder,
      userQty: ui.totalQty, userPayments: 1,
      progress: lotReal.minimumOrder > 0
        ? Math.min((lotReal.accumulatedQty / lotReal.minimumOrder) * 100, 100) : 0,
      isReservation: true, isPendingLot: ui.status === "pending_lot",
      lotClosed: ui.status === "lot_closed" || lotReal.status === "closed",
      paymentLink: ui.paymentLink, totalFinal: ui.totalFinal,
      buyerCount: lotReal.buyerCount,
    });
  }

  // Completar nombres faltantes
  const lotsWithoutName = activeLots.filter((l) => !l.productName || l.productName === "Producto");
  if (lotsWithoutName.length > 0) {
    const productIds = [...new Set(lotsWithoutName.map((l) => l.productId))];
    for (let i = 0; i < productIds.length; i += 10) {
      const snap = await db.collection("products").where("__name__", "in", productIds.slice(i, i + 10)).get();
      const pm   = new Map<string, string>();
      snap.docs.forEach((d) => pm.set(d.id, d.data().name));
      activeLots.forEach((l) => {
        if ((!l.productName || l.productName === "Producto") && pm.has(l.productId))
          l.productName = pm.get(l.productId)!;
      });
    }
  }

  /* ── UI ── */
  // Ordenar: primero los que requieren acción (pagar), luego el resto
  const sortedLots = [...activeLots].sort((a, b) => {
    const aUrgent = a.lotClosed && a.isReservation && a.paymentLink ? 0 : 1;
    const bUrgent = b.lotClosed && b.isReservation && b.paymentLink ? 0 : 1;
    return aUrgent - bUrgent;
  });

  const nivel = getNivel(score);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── TOP ACCENT BAR — jerarquía visual inmediata ── */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${nivel.colorAccent}, #3B82F6, #F97316)` }} />

      <div className="px-6 py-8 max-w-6xl mx-auto">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            {/* Saludo con nombre — personalización aumenta engagement (Fogg, 2003) */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              Panel de comprador
            </p>
            <h1 className="text-3xl font-black text-gray-900 leading-tight">
              Hola, {userName} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Gestioná tus compras y seguí tu progreso
            </p>
          </div>
          <UserRoleHeader
            userEmail={userEmail}
            activeRole="retailer"
            userName={userName}
            milestoneBadges={milestoneBadges}
            streakBadges={streakBadges}
            currentStreak={currentStreak}
          />
        </div>

        {/* ── KPIs — anclaje de valor histórico (Ariely) ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            {
              label: "Total invertido",
              value: formatCurrency(totalInvertido),
              sub: "tu historial de compras",
              accent: nivel.colorAccent,
              // El KPI más grande primero — jerarquía visual F-pattern
              big: true,
            },
            {
              label: "Pedidos completados",
              value: pedidosTotalesCount.toString(),
              sub: "lotes y directas",
              accent: "#3B82F6",
              big: false,
            },
            {
              label: "En proceso ahora",
              value: pedidosEnProcesoCount.toString(),
              sub: pedidosEnProcesoCount > 0 ? "requieren atención" : "sin lotes activos",
              accent: pedidosEnProcesoCount > 0 ? "#F97316" : "#9CA3AF",
              big: false,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden"
            >
              {/* Accent corner */}
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-5"
                style={{ background: s.accent }}
              />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {s.label}
              </p>
              <p
                className="font-black leading-none mb-1"
                style={{ fontSize: s.big ? "1.75rem" : "1.5rem", color: s.accent }}
              >
                {s.value}
              </p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── PANELES DE GAMIFICACIÓN ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              Tu perfil de comprador
            </h2>
            {/* Microcopy de identidad — Tajfel: pertenencia a grupo */}
            <span className="text-xs text-gray-400 font-medium">
              {milestoneBadges.length + streakBadges.length > 0
                ? `${milestoneBadges.length + streakBadges.length} logros desbloqueados`
                : "Empezá a comprar para desbloquear logros"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PanelNivel score={score} compraTotal={totalInvertido} />
            <PanelRacha currentStreak={currentStreak} />
            <PanelBadgesPermanentes lotesTotal={lotesCompletados} />
          </div>
        </div>

        {/* ── LOTES EN CURSO ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              Pedidos fraccionados en curso
            </h2>
            {pedidosEnProcesoCount > 0 && (
              <Pill variant="orange">{pedidosEnProcesoCount} activos</Pill>
            )}
          </div>

          <div className="p-6">
            {sortedLots.length === 0 ? (
              /* Estado vacío con CTA claro */
              <div className="text-center py-10">
                <p className="text-3xl mb-3">📦</p>
                <p className="text-gray-500 text-sm font-medium">No tenés pedidos en proceso.</p>
                <p className="text-gray-400 text-xs mt-1 mb-5">
                  Explorá los lotes disponibles y sumarte a una compra.
                </p>
                <Link
                  href="/explorar"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  Ver productos disponibles →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedLots.map((lot) => {
                  const progressPercent = Math.round(lot.progress);
                  const isNearComplete  = progressPercent >= 80;
                  const needsPayment    = lot.lotClosed && lot.isReservation && !!lot.paymentLink;

                  return (
                    <div
                      key={lot.id}
                      className={`rounded-2xl border-2 p-5 transition-all ${
                        needsPayment
                          // Requiere acción: borde azul prominente (CTA hierarchy)
                          ? "border-blue-300 bg-blue-50 shadow-md"
                          : isNearComplete
                          ? "border-green-200 bg-green-50"
                          : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      {/* Header del lote */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                          <span className="font-bold text-gray-900 text-base leading-tight">
                            {lot.productName}
                          </span>

                          {lot.isReservation && lot.isPendingLot && (
                            <Pill variant="orange">Reserva</Pill>
                          )}
                          {needsPayment && (
                            // Urgencia real — pill rojo solo cuando hay acción requerida
                            <Pill variant="red">⚡ Pago requerido</Pill>
                          )}
                          {!lot.isReservation && lot.lotClosed && (
                            <Pill variant="amber">Esperando pagos del grupo</Pill>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Social proof inline — Cialdini: validación social */}
                          {(lot.buyerCount ?? 0) > 1 && !lot.lotClosed && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              👥 {lot.buyerCount} compradores
                            </span>
                          )}
                          <span className="text-xs text-gray-400 whitespace-nowrap font-medium">
                            {lot.accumulatedQty} / {lot.minimumOrder} uds.
                          </span>
                          {!lot.isPendingLot && !lot.lotClosed && (
                            <HideOrderButton itemId={lot.id} label="Ocultar" />
                          )}
                        </div>
                      </div>

                      {/* Detalle de compra */}
                      <p className="text-xs text-gray-500 mb-3">
                        Tu pedido:{" "}
                        <strong className="text-gray-700">{lot.userQty} unidades</strong>
                        {!lot.isReservation && lot.userPayments > 1 &&
                          ` en ${lot.userPayments} compras`}
                      </p>

                      {/* Barra de progreso del lote */}
                      {!lot.lotClosed && (
                        <div className="mb-3">
                          <Bar
                            pct={progressPercent}
                            colorClass={isNearComplete ? "bg-green-500" : "bg-blue-500"}
                            height="h-3"
                          />
                          <div className="flex justify-between items-center mt-1.5">
                            <span className={`text-xs font-medium ${isNearComplete ? "text-green-600" : "text-gray-400"}`}>
                              {isNearComplete ? "🟢 ¡Casi listo! El lote está por cerrarse" : `${progressPercent}% completado`}
                            </span>
                            <span className="text-xs text-gray-400">
                              Faltan {lot.minimumOrder - lot.accumulatedQty} uds.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Reserva pendiente */}
                      {lot.isReservation && lot.isPendingLot && (
                        <AlertBox icon="🔖" variant="orange">
                          Cuando el lote se complete, te mandamos el link de pago por email.
                        </AlertBox>
                      )}

                      {/* CTA de pago — posición prominente, botón grande, urgencia real */}
                      {needsPayment && (
                        <div className="mt-3">
                          <AlertBox icon="✅" variant="blue">
                            El lote alcanzó el mínimo. Completá tu pago para asegurar tu compra.
                          </AlertBox>
                          <a
                            href={lot.paymentLink}
                            className="mt-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold px-5 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg w-full"
                          >
                            💳 Pagar ahora — {formatCurrency(lot.totalFinal ?? 0)}
                          </a>
                        </div>
                      )}

                      {/* Esperando otros compradores */}
                      {lot.lotClosed && !lot.isReservation && (
                        <AlertBox icon="⏳" variant="amber">
                          Tu pago está confirmado — esperando que los demás compradores del lote paguen.
                        </AlertBox>
                      )}

                      {/* Cancelar reserva */}
                      {lot.isReservation && lot.isPendingLot && lot.reservationDocId && (
                        <div className="mt-3">
                          <CancelReservationButton
                            reservationId={lot.reservationDocId}
                            productName={lot.productName}
                          />
                        </div>
                      )}

                      {lot.isReservation && lot.lotClosed && !lot.paymentLink && (
                        <p className="text-xs text-gray-400 mt-2.5 flex items-center gap-1.5">
                          <span>🔒</span>
                          <span>El lote cerró — no es posible darse de baja en esta etapa.</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CTA EXPLORAR — siempre visible, nunca escondido ── */}
        {/* BASE: F-pattern, el CTA de adquisición siempre al final del flujo */}
        <Link
          href="/explorar"
          className="group flex items-center justify-between bg-white hover:bg-blue-50 border-2 border-blue-200 hover:border-blue-400 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all"
        >
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-0.5">
              Explorar productos disponibles
            </h2>
            <p className="text-sm text-gray-500">
              Comprá directo o sumarte a un lote fraccionado
            </p>
          </div>
          <span className="text-blue-600 font-bold text-sm group-hover:translate-x-1.5 transition-transform inline-block shrink-0 ml-4">
            Ver productos →
          </span>
        </Link>

      </div>
    </div>
  );
}

export default function DashboardRevendedor() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardRevendedorContent />
    </Suspense>
  );
}