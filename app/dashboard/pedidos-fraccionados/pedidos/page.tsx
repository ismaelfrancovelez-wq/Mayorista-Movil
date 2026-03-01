// app/dashboard/pedidos-fraccionados/pedidos/page.tsx
import { db } from "../../../../lib/firebase-admin";
import { cookies } from "next/headers";
import { formatCurrency } from "../../../../lib/utils";
import CancelReservationButton from "../../../../components/CancelReservationButton";
import HideOrderButton from "../../../../components/HideOrderButton";
import { STREAK_BADGES, MILESTONE_BADGES } from "../../../../lib/retailers/calculateScore";

export const dynamic = "force-dynamic";
export const revalidate = 10;

type ReservationStatus = "pending_lot" | "lot_closed" | "paid" | "cancelled";

type Pedido = {
  id: string;
  reservationDocId?: string;
  productId: string;
  productName: string;
  factoryName: string;
  qty: number;
  orderType: "directa" | "fraccionado";
  lotType?: string;
  lotId?: string;
  isReservation?: boolean;
  reservationStatus?: ReservationStatus;
  lotMates?: { name: string; paid: boolean; streakBadge?: string; milestoneBadge?: string }[];
  paymentLink?: string;
  totalFinal?: number;
  status: "accumulating" | "lot_closed" | "all_paid" | "completed";
  amount: number;
  shippingCost: number;
  shippingCostEstimated?: number;
  total: number;
  createdAt: string;
  createdAtTimestamp: number;
  purchaseCount?: number;
  lotClosedAt?: number;
  lotProgress?: {
    currentQty: number;
    targetQty: number;
    percentage: number;
    remaining: number;
  };
  // BLOQUE 2 impl 5: datos de comisión para mostrar costo concreto
  commissionAmount?: number;
  commissionRate?: number;
};

// ── BLOQUE 2 impl 4 — Configuración de niveles ──────────────────────────────
const LEVEL_CONFIG: Record<number, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  rate: number;        // tasa de comisión (0.09, 0.12, 0.14, 0.16)
  pct: string;         // string para mostrar ("9%", "12%", etc.)
  // BLOQUE 2 impl 6: framing positivo del nivel
  framingLabel: string;
  framingDesc: string;
}> = {
  1: {
    label: "Verde",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    rate: 0.09,
    pct: "9%",
    framingLabel: "Nivel Verde — Máximo beneficio",
    framingDesc: "Estás en el nivel más alto. Seguí así para mantener la comisión más baja.",
  },
  2: {
    label: "Amarillo",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    rate: 0.12,
    pct: "12%",
    framingLabel: "Nivel Amarillo — En progreso",
    framingDesc: "Podés alcanzar el Nivel Verde mejorando tu historial de pagos.",
  },
  3: {
    label: "Naranja",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    rate: 0.14,
    pct: "14%",
    framingLabel: "Nivel Naranja — Desarrollando confianza",
    framingDesc: "Cada pago a tiempo te acerca al Nivel Amarillo y a mejores condiciones.",
  },
  4: {
    label: "Rojo",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    rate: 0.16,
    pct: "16%",
    framingLabel: "Revendedor en Construcción",  // IMPL 6: framing positivo
    framingDesc: "Estás construyendo tu historial. Cada pago puntual reduce tu comisión.",
  },
};

// ── BLOQUE 2 impl 5 — Componente de costo concreto ───────────────────────────
// Muestra al revendedor exactamente cuánto está pagando de más vs nivel Verde.
// Implementa Pain of Paying (Prelec & Loewenstein, 1998) y Efecto de Saliencia (Kahneman, 2011).
function CommissionCostBanner({
  currentLevel,
  productSubtotal,
  commissionAmount,
}: {
  currentLevel: number;
  productSubtotal: number;
  commissionAmount: number;
}) {
  if (currentLevel === 1) {
    // Nivel Verde: ya tiene el máximo beneficio, mostrar mensaje positivo
    return (
      <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
        <span className="text-lg">🟢</span>
        <div>
          <p className="text-xs font-semibold text-green-800">
            Nivel Verde — Comisión 9%
          </p>
          <p className="text-xs text-green-700">
            Estás pagando la comisión más baja disponible. ¡Seguí así!
          </p>
        </div>
      </div>
    );
  }

  const currentCfg  = LEVEL_CONFIG[currentLevel] ?? LEVEL_CONFIG[4];
  const greenCfg    = LEVEL_CONFIG[1];
  const greenCommission = Math.round(productSubtotal * greenCfg.rate);
  const difference  = commissionAmount - greenCommission;

  if (difference <= 0) return null;

  return (
    <div className={`mb-4 p-3 rounded-lg border ${currentCfg.bgColor} ${currentCfg.borderColor}`}>
      {/* Línea 1: qué estás pagando ahora */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">💸</span>
        <p className={`text-xs font-semibold ${currentCfg.color}`}>
          Pagás {currentCfg.pct} de comisión — {currentCfg.framingLabel}
        </p>
      </div>
      {/* Línea 2: comparación concreta con nivel Verde */}
      <p className="text-xs text-gray-700 ml-7">
        Con <strong>Nivel Verde</strong> pagarías {greenCfg.pct}.
        En este lote eso equivale a{" "}
        <strong className="text-red-600">{formatCurrency(difference)} de diferencia</strong>.
      </p>
      {/* Línea 3: framing de progreso (IMPL 6) */}
      <p className={`text-xs mt-1.5 ml-7 ${currentCfg.color}`}>
        📈 {currentCfg.framingDesc}
      </p>
    </div>
  );
}

// ── Tabla de beneficios/sanciones ────────────────────────────────────────────
function PaymentTiersTable({ lotClosedAtMs }: { lotClosedAtMs?: number }) {
  const now = Date.now();
  const elapsed = lotClosedAtMs ? Math.floor((now - lotClosedAtMs) / (1000 * 60 * 60)) : 0;

  const hoursLeft = lotClosedAtMs
    ? Math.max(0, 96 - Math.floor((now - lotClosedAtMs) / (1000 * 60 * 60)))
    : 96;
  const daysLeft = Math.floor(hoursLeft / 24);
  const hoursRemainder = hoursLeft % 24;

  const countdownText =
    hoursLeft === 0
      ? "⏰ Plazo vencido"
      : daysLeft > 0
      ? `⏰ ${daysLeft}d ${hoursRemainder}h restantes`
      : `⏰ ${hoursLeft}h restantes`;

  const countdownColor = hoursLeft <= 24 ? "text-red-600 font-bold" : hoursLeft <= 48 ? "text-orange-600 font-semibold" : "text-blue-700 font-semibold";

  const tiers = [
    {
      range: "Dentro de 24h",
      icon: "🌟",
      label: "RÁPIDO",
      benefit: "+1 punto de racha · Prioridad garantizada en el próximo lote",
      color: "bg-green-50 border-green-300 text-green-800",
      iconBg: "bg-green-100",
      active: elapsed <= 24,
    },
    {
      range: "Entre 24h y 48h",
      icon: "✅",
      label: "A TIEMPO",
      benefit: "Sin penalización",
      color: "bg-gray-50 border-gray-200 text-gray-700",
      iconBg: "bg-gray-100",
      active: elapsed > 24 && elapsed <= 48,
    },
    {
      range: "Entre 48h y 72h",
      icon: "⚠️",
      label: "TARDÍO",
      benefit: "−1 punto de racha",
      color: "bg-yellow-50 border-yellow-300 text-yellow-800",
      iconBg: "bg-yellow-100",
      active: elapsed > 48 && elapsed <= 72,
    },
    {
      range: "Entre 72h y 96h",
      icon: "🔴",
      label: "MUY TARDÍO",
      benefit: "−1 punto de racha · Última posición en los próximos lotes",
      color: "bg-orange-50 border-orange-300 text-orange-800",
      iconBg: "bg-orange-100",
      active: elapsed > 72 && elapsed <= 96,
    },
    {
      range: "Después de 96h",
      icon: "❌",
      label: "CANCELADO",
      benefit: "Reserva cancelada automáticamente · −1 punto de racha",
      color: "bg-red-50 border-red-300 text-red-800",
      iconBg: "bg-red-100",
      active: elapsed > 96,
    },
  ];

  return (
    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      {lotClosedAtMs && (
        <div className={`text-center text-sm mb-3 ${countdownColor}`}>
          {countdownText} para pagar sin penalización
        </div>
      )}
      <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">
        💡 Beneficios y sanciones según cuándo pagás
      </p>
      <div className="space-y-1.5">
        {tiers.map((tier) => (
          <div
            key={tier.range}
            className={`flex items-center gap-2 p-2 rounded border text-xs ${tier.color} ${tier.active ? "ring-2 ring-blue-400" : ""}`}
          >
            <span className={`w-7 h-7 flex items-center justify-center rounded-full text-base flex-shrink-0 ${tier.iconBg}`}>
              {tier.icon}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{tier.range}</span>
              <span className="mx-1 text-gray-400">·</span>
              <span>{tier.benefit}</span>
            </div>
            {tier.active && (
              <span className="text-blue-700 font-bold text-xs flex-shrink-0">← ahora</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-blue-700 mt-2.5 text-center">
        🏆 Acumulá reservas para desbloquear descuentos en envío y llegar al lote gratis
      </p>
    </div>
  );
}


// ── BLOQUE 5 impl 13 — Barras de progreso ────────────────────────────────────
// Tres barras: nivel de confianza, badge de racha, badge permanente.
// Goal Gradient Effect (Kivetz, 2006): la barra se vuelve dorada cuando quedan 1-2 pasos.

function ProgressBar({
  label,
  sublabel,
  pct,
  urgent,
  color,
  icon,
  nextLabel,
  currentLabel,
}: {
  label: string;
  sublabel: string;
  pct: number;
  urgent: boolean;
  color: string;         // clases Tailwind para la barra llena
  icon: string;
  nextLabel: string;     // texto del siguiente hito
  currentLabel: string;  // texto del estado actual
}) {
  const barColor = urgent
    ? "bg-gradient-to-r from-yellow-400 to-orange-500"
    : color;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1 truncate">
          <span>{icon}</span>
          <span className="truncate">{label}</span>
        </span>
        <span className={`text-xs font-bold flex-shrink-0 ${urgent ? "text-orange-600" : "text-gray-500"}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1 relative overflow-hidden">
        <div
          className={`${barColor} h-2.5 rounded-full transition-all duration-500 ${urgent ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 truncate">{currentLabel}</span>
        <span className={`text-xs truncate text-right ${urgent ? "text-orange-600 font-semibold" : "text-gray-400"}`}>
          → {nextLabel}
        </span>
      </div>
      {urgent && (
        <p className="text-xs text-orange-600 font-semibold mt-0.5 text-center">
          ¡Muy cerca!
        </p>
      )}
    </div>
  );
}

// ── BLOQUE 5 impl 12 — Badges con 3 estados ──────────────────────────────────
// Estado 1 bloqueado: gris con candado + tooltip
// Estado 2 desbloqueado: color completo
// Estado 3 racha activa: color + pulso animado
// Information Gap Theory (Loewenstein, 1994): badge bloqueado pero visible activa la anticipación.

function BadgeChip({
  label,
  state,          // "locked" | "unlocked" | "active"
  tooltip,
  color,          // clases de color para estado unlocked/active
}: {
  label: string;
  state: "locked" | "unlocked" | "active";
  tooltip?: string;
  color: string;
}) {
  if (state === "locked") {
    return (
      <span
        title={tooltip}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-help select-none"
      >
        🔒 {label}
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border animate-pulse ${color}`}
      >
        ⚡ {label}
      </span>
    );
  }
  // unlocked
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      🏅 {label}
    </span>
  );
}

// ── Función principal de datos ────────────────────────────────────────────────
async function getRetailerOrders(retailerId: string, hiddenIds: string[]): Promise<Pedido[]> {

  const [paymentsSnap, myReservationsSnap] = await Promise.all([
    db.collection("payments").where("retailerId", "==", retailerId).limit(50).get(),
    db.collection("reservations")
      .where("retailerId", "==", retailerId)
      .where("status", "in", ["pending_lot", "lot_closed", "paid"])
      .limit(50)
      .get(),
  ]);

  const lotIds = new Set<string>();
  paymentsSnap.docs.forEach((d) => { if (d.data().lotId) lotIds.add(d.data().lotId); });
  myReservationsSnap.docs.forEach((d) => { if (d.data().lotId) lotIds.add(d.data().lotId); });

  const lotsMap = new Map<string, { status: string; accumulatedQty: number; minimumOrder: number; closedAt?: number }>();
  if (lotIds.size > 0) {
    const arr = Array.from(lotIds);
    for (let i = 0; i < arr.length; i += 10) {
      const snap = await db.collection("lots").where("__name__", "in", arr.slice(i, i + 10)).get();
      snap.docs.forEach((d) => {
        lotsMap.set(d.id, {
          status: d.data().status,
          accumulatedQty: d.data().accumulatedQty || 0,
          minimumOrder: d.data().minimumOrder || d.data().minimumQty || 0,
          closedAt: d.data().closedAt?.toMillis?.() || undefined,
        });
      });
    }
  }

  const lotIdsNeedingMates = new Set<string>();
  myReservationsSnap.docs.forEach((d) => {
    const r = d.data();
    if ((r.status === "lot_closed" || r.status === "paid") && r.lotId) {
      lotIdsNeedingMates.add(r.lotId);
    }
  });

  // ── BLOQUE 2 impl 5 — Labels actualizados con nuevos badge IDs ──────────────
  const STREAK_LABELS: Record<string, string> = {
    streak_start:     "🔗 Primer Vínculo",
    streak_explorer:  "🧭 Explorador",
    streak_steady:    "📌 Constante",
    streak_committed: "💪 Comprometido",
    streak_unstop:    "⚡ Imparable",
    streak_vip_b:     "🥉 VIP Bronce",
    streak_vip_s:     "🥈 VIP Plata",
    streak_vip_g:     "🥇 VIP Oro",
    streak_legend:    "🌟 Leyenda",
  };
  const MILESTONE_LABELS: Record<string, string> = {
    milestone_first:     "🥉 Primer Vinculo",
    milestone_solid:     "🥈 Revendedor Tallado",
    milestone_operator:  "🥇 Maestro del Sector",
    milestone_strategic: "🤝 Socio Estratégico",
    milestone_founding:  "🏆 Socio Fundador de MayoristaMovil",
  };

  const lotMatesMap = new Map<string, { name: string; paid: boolean; streakBadge?: string; milestoneBadge?: string }[]>();
  if (lotIdsNeedingMates.size > 0) {
    for (const lotId of Array.from(lotIdsNeedingMates)) {
      const allResSnap = await db
        .collection("reservations")
        .where("lotId", "==", lotId)
        .where("status", "in", ["lot_closed", "paid"])
        .get();

      const retailerIds = allResSnap.docs.map((d) => d.data().retailerId).filter(Boolean);
      const retailerBadgesMap = new Map<string, { streakBadge?: string; milestoneBadge?: string }>();
      if (retailerIds.length > 0) {
        for (let i = 0; i < retailerIds.length; i += 10) {
          const chunk = retailerIds.slice(i, i + 10);
          const retailersSnap = await db.collection("retailers").where("__name__", "in", chunk).get();
          retailersSnap.docs.forEach((rd) => {
            const streakBadges: string[] = rd.data().streakBadges ?? [];
            const milestoneBadges: string[] = rd.data().milestoneBadges ?? [];
            const topStreak = streakBadges.length > 0 ? STREAK_LABELS[streakBadges[streakBadges.length - 1]] : undefined;
            const topMilestone = milestoneBadges.length > 0 ? MILESTONE_LABELS[milestoneBadges[milestoneBadges.length - 1]] : undefined;
            retailerBadgesMap.set(rd.id, { streakBadge: topStreak, milestoneBadge: topMilestone });
          });
        }
      }

      lotMatesMap.set(
        lotId,
        allResSnap.docs.map((d) => {
          const badges = retailerBadgesMap.get(d.data().retailerId) ?? {};
          return {
            name: d.data().retailerName || "Comprador",
            paid: d.data().status === "paid",
            streakBadge: badges.streakBadge,
            milestoneBadge: badges.milestoneBadge,
          };
        })
      );
    }
  }

  function buildLotProgress(lotId?: string) {
    if (!lotId) return undefined;
    const lot = lotsMap.get(lotId);
    if (!lot || !lot.minimumOrder) return undefined;
    return {
      currentQty: lot.accumulatedQty,
      targetQty: lot.minimumOrder,
      percentage: Math.min((lot.accumulatedQty / lot.minimumOrder) * 100, 100),
      remaining: Math.max(lot.minimumOrder - lot.accumulatedQty, 0),
    };
  }

  const reservationLotIds = new Set<string>();
  const reservationOrders: Pedido[] = [];

  for (const resDoc of myReservationsSnap.docs) {
    const r = resDoc.data();
    if (!r.lotId || r.status === "cancelled") continue;

    const listId = `reservation-${resDoc.id}`;
    if (hiddenIds.includes(listId)) continue;

    reservationLotIds.add(r.lotId);

    const resStatus = r.status as ReservationStatus;
    const mates = lotMatesMap.get(r.lotId) || [];
    const unpaidCount = mates.filter((m) => !m.paid).length;
    const allPaid = mates.length > 0 && unpaidCount === 0;

    let pedidoStatus: Pedido["status"] = "accumulating";
    if (resStatus === "lot_closed") {
      pedidoStatus = "lot_closed";
    } else if (resStatus === "paid") {
      pedidoStatus = allPaid ? "all_paid" : "lot_closed";
    }

    const shippingFinal = r.shippingCostFinal ?? r.shippingCostEstimated ?? 0;
    const lotData = lotsMap.get(r.lotId);

    reservationOrders.push({
      id: listId,
      reservationDocId: resDoc.id,
      productId: r.productId,
      productName: r.productName || "Producto",
      factoryName: r.factoryName || "Fabricante",
      qty: r.qty || 0,
      orderType: "fraccionado",
      lotType: r.shippingMode === "pickup" ? "fraccionado_retiro" : "fraccionado_envio",
      lotId: r.lotId,
      isReservation: true,
      reservationStatus: resStatus,
      lotMates: mates,
      paymentLink: resStatus === "lot_closed" ? (r.paymentLink || null) : null,
      totalFinal: r.totalFinal || null,
      status: pedidoStatus,
      amount: r.productSubtotal || 0,
      shippingCost: (resStatus === "paid" || resStatus === "lot_closed") ? shippingFinal : 0,
      shippingCostEstimated: r.shippingCostEstimated || 0,
      total: resStatus === "paid" ? (r.totalFinal || 0) : 0,
      createdAt: r.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      createdAtTimestamp: r.createdAt?.toMillis() || 0,
      lotClosedAt: r.lotClosedAt?.toMillis?.() || lotData?.closedAt || undefined,
      lotProgress: resStatus === "pending_lot" ? buildLotProgress(r.lotId) : undefined,
      // BLOQUE 2 impl 5: datos de comisión guardados en la reserva
      commissionAmount: r.commission || 0,
      commissionRate: r.paymentLevel ?? 2,
    });
  }

  const fractionalGrouped = new Map<string, { payments: any[]; totalQty: number; totalAmount: number; totalShipping: number; totalTotal: number; oldestDate: number; latestDate: number }>();
  const directOrders: Pedido[] = [];

  for (const paymentDoc of paymentsSnap.docs) {
    const p = paymentDoc.data();

    if (p.orderType === "directa") {
      const listId = `payment-${paymentDoc.id}`;
      if (hiddenIds.includes(listId)) continue;

      directOrders.push({
        id: listId,
        productId: p.productId,
        productName: p.productName || "Producto",
        factoryName: p.factoryName || "Fabricante",
        qty: p.qty || 0,
        orderType: "directa",
        status: "completed",
        amount: p.amount || 0,
        shippingCost: p.shippingCost || 0,
        total: p.total || 0,
        createdAt: p.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
        createdAtTimestamp: p.createdAt?.toMillis() || 0,
      });

    } else if (p.orderType === "fraccionado" && p.lotId) {
      if (reservationLotIds.has(p.lotId)) continue;
      if (hiddenIds.includes(p.lotId)) continue;

      const lotId = p.lotId;
      if (fractionalGrouped.has(lotId)) {
        const g = fractionalGrouped.get(lotId)!;
        g.payments.push(p);
        g.totalQty += p.qty || 0;
        g.totalAmount += p.amount || 0;
        g.totalShipping += p.shippingCost || 0;
        g.totalTotal += p.total || 0;
        g.latestDate = Math.max(g.latestDate, p.createdAt?.toMillis() || 0);
        g.oldestDate = Math.min(g.oldestDate, p.createdAt?.toMillis() || 0);
      } else {
        fractionalGrouped.set(lotId, {
          payments: [p],
          totalQty: p.qty || 0,
          totalAmount: p.amount || 0,
          totalShipping: p.shippingCost || 0,
          totalTotal: p.total || 0,
          oldestDate: p.createdAt?.toMillis() || 0,
          latestDate: p.createdAt?.toMillis() || 0,
        });
      }
    }
  }

  const fraccionadoOrders: Pedido[] = [];
  for (const [lotId, group] of fractionalGrouped.entries()) {
    const fp = group.payments[0];
    const lotData = lotsMap.get(lotId);
    const CLOSED_STATUSES = new Set(["closed", "processing", "processed_pending_payment"]);
    const status: Pedido["status"] =
      lotData?.status === "fully_paid"
        ? "all_paid"
        : CLOSED_STATUSES.has(lotData?.status ?? "")
        ? "lot_closed"
        : "accumulating";

    fraccionadoOrders.push({
      id: lotId,
      productId: fp.productId,
      productName: fp.productName || "Producto",
      factoryName: fp.factoryName || "Fabricante",
      qty: group.totalQty,
      orderType: "fraccionado",
      lotType: fp.lotType,
      lotId,
      status,
      amount: group.totalAmount,
      shippingCost: group.totalShipping,
      total: group.totalTotal,
      purchaseCount: group.payments.length,
      createdAt: new Date(group.oldestDate).toLocaleDateString("es-AR"),
      createdAtTimestamp: group.latestDate,
      lotProgress: buildLotProgress(lotId),
      lotClosedAt: lotsMap.get(lotId)?.closedAt,
    });
  }

  const allOrders = [...reservationOrders, ...fraccionadoOrders, ...directOrders];
  allOrders.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
  return allOrders;
}

/* ====================================================
   PAGE
==================================================== */
export default async function PedidosPage() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "retailer") {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">No autorizado</h1>
          <p className="text-red-600">Debes tener rol de revendedor para acceder a esta página</p>
        </div>
      </div>
    );
  }

  const userSnap = await db.collection("users").doc(userId).get();
  const hiddenIds: string[] = userSnap.data()?.hiddenOrders || [];

  // BLOQUE 2+5: leer nivel, score, racha y badges del retailer
  const retailerSnap = await db.collection("retailers").doc(userId).get();
  const retailerData = retailerSnap.data() ?? {};
  const retailerLevel: number       = retailerData.paymentLevel         ?? 2;
  const retailerScore: number       = retailerData.scoreAggregate?.score ?? 0.6;
  const currentStreak: number       = retailerData.currentStreak         ?? 0;
  const completedLots: number       = retailerData.completedReservations  ?? 0;
  const streakBadges: string[]      = retailerData.streakBadges           ?? [];
  const milestoneBadges: string[]   = retailerData.milestoneBadges        ?? [];

  const orders = await getRetailerOrders(userId, hiddenIds);

  // BLOQUE 2 impl 6: framing del nivel actual del retailer
  const levelCfg = LEVEL_CONFIG[retailerLevel] ?? LEVEL_CONFIG[2];

  // BLOQUE 5 impl 13: calcular próximos hitos para las 3 barras de progreso
  const nextStreakBadge  = STREAK_BADGES.find((b) => currentStreak < b.streak) ?? null;
  const nextMilestone    = MILESTONE_BADGES.find((b) => completedLots < b.lots) ?? null;
  // Score hacia nivel 1 (Verde): target 0.75, actual retailerScore
  const scoreToGreen     = Math.min(retailerScore / 0.75, 1);
  const scoreToGreenPct  = Math.round(scoreToGreen * 100);
  // Racha: progreso hacia próximo badge
  const streakPrev       = nextStreakBadge
    ? (STREAK_BADGES[STREAK_BADGES.indexOf(nextStreakBadge) - 1]?.streak ?? 0)
    : (STREAK_BADGES[STREAK_BADGES.length - 1]?.streak ?? 0);
  const streakTarget     = nextStreakBadge?.streak ?? streakPrev;
  const streakPct        = nextStreakBadge
    ? Math.round(Math.min((currentStreak - streakPrev) / (streakTarget - streakPrev), 1) * 100)
    : 100;
  // Milestone: progreso hacia próximo badge permanente
  const milestonePrev    = nextMilestone
    ? (MILESTONE_BADGES[MILESTONE_BADGES.indexOf(nextMilestone) - 1]?.lots ?? 0)
    : (MILESTONE_BADGES[MILESTONE_BADGES.length - 1]?.lots ?? 0);
  const milestoneTarget  = nextMilestone?.lots ?? milestonePrev;
  const milestonePct     = nextMilestone
    ? Math.round(Math.min((completedLots - milestonePrev) / (milestoneTarget - milestonePrev), 1) * 100)
    : 100;
  // Colores de urgencia (dorado cuando quedan 1-2 para el siguiente hito)
  const streakUrgent     = nextStreakBadge && (nextStreakBadge.streak - currentStreak) <= 2;
  const milestoneUrgent  = nextMilestone   && (nextMilestone.lots    - completedLots)  <= 2;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Pedidos</h1>
          <p className="text-gray-600">Últimos 50 pedidos (actualizado cada 10 segundos)</p>

          {/* BLOQUE 2 impl 6 — Banner de nivel actual con framing positivo */}
          <div className={`mt-4 p-4 rounded-lg border ${levelCfg.bgColor} ${levelCfg.borderColor}`}>
            {/* Fila superior: nivel + comisión */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl flex-shrink-0">
                {retailerLevel === 1 ? "🟢" : retailerLevel === 2 ? "🟡" : retailerLevel === 3 ? "🟠" : "🔴"}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${levelCfg.color}`}>
                  {levelCfg.framingLabel}
                </p>
                <p className="text-xs text-gray-600">{levelCfg.framingDesc}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`text-lg font-bold ${levelCfg.color}`}>{levelCfg.pct}</p>
                <p className="text-xs text-gray-500">comisión actual</p>
              </div>
            </div>

            {/* BLOQUE 5 impl 13 — Tres barras de progreso */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              {/* Barra 1: Nivel de confianza → Nivel Verde */}
              <ProgressBar
                label="Nivel de confianza"
                sublabel="Score hacia Nivel Verde"
                pct={retailerLevel === 1 ? 100 : scoreToGreenPct}
                urgent={retailerLevel !== 1 && scoreToGreenPct >= 85}
                color="bg-gradient-to-r from-green-400 to-green-600"
                icon="📊"
                currentLabel={`Nivel ${levelCfg.label} — Score ${Math.round(retailerScore * 100)}/100`}
                nextLabel={retailerLevel === 1 ? "¡Nivel Verde alcanzado!" : "Nivel Verde (9%)"}
              />

              {/* Barra 2: Badge de racha */}
              <ProgressBar
                label="Racha"
                sublabel="Puntos hacia próximo badge"
                pct={streakPct}
                urgent={!!streakUrgent}
                color="bg-gradient-to-r from-blue-400 to-blue-600"
                icon="⚡"
                currentLabel={`${currentStreak} pt${currentStreak !== 1 ? "s" : ""}`}
                nextLabel={nextStreakBadge ? `${nextStreakBadge.label} (${nextStreakBadge.streak} pts)` : "¡Racha máxima!"}
              />

              {/* Barra 3: Badge permanente (milestone) */}
              <ProgressBar
                label="Historial"
                sublabel="Lotes hacia próximo badge permanente"
                pct={milestonePct}
                urgent={!!milestoneUrgent}
                color="bg-gradient-to-r from-amber-400 to-amber-600"
                icon="🎖️"
                currentLabel={`${completedLots} lote${completedLots !== 1 ? "s" : ""} pagados`}
                nextLabel={nextMilestone ? `${nextMilestone.label} (${nextMilestone.lots} lotes)` : "¡Máximo nivel!"}
              />
            </div>

            {/* BLOQUE 5 impl 12 — Badges con 3 estados */}
            {/* Badges de racha */}
            <div className="mb-2">
              <p className="text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Badges de racha</p>
              <div className="flex flex-wrap gap-1.5">
                {STREAK_BADGES.map((b) => {
                  const isActive   = streakBadges.includes(b.id) && b.streak === (STREAK_BADGES.slice().reverse().find(x => streakBadges.includes(x.id))?.streak ?? -1);
                  const isUnlocked = streakBadges.includes(b.id) && !isActive;
                  const state      = isActive ? "active" : isUnlocked ? "unlocked" : "locked";
                  const ptsLeft    = b.streak - currentStreak;
                  return (
                    <BadgeChip
                      key={b.id}
                      label={b.label}
                      state={state}
                      tooltip={state === "locked" ? `Alcanzá ${b.streak} puntos de racha para desbloquear (te faltan ${ptsLeft})` : undefined}
                      color="bg-blue-100 text-blue-800 border-blue-300"
                    />
                  );
                })}
              </div>
            </div>

            {/* Badges permanentes */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Badges permanentes</p>
              <div className="flex flex-wrap gap-1.5">
                {MILESTONE_BADGES.map((b) => {
                  const isUnlocked = milestoneBadges.includes(b.id);
                  const lotsLeft   = b.lots - completedLots;
                  return (
                    <BadgeChip
                      key={b.id}
                      label={b.label}
                      state={isUnlocked ? "unlocked" : "locked"}
                      tooltip={!isUnlocked ? `Completá ${b.lots} lotes para desbloquear (te faltan ${lotsLeft})` : undefined}
                      color="bg-amber-100 text-amber-800 border-amber-300"
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 text-lg mb-4">No tenés pedidos todavía</p>
            <a href="/explorar" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Explorar productos
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isFraccionado = order.orderType === "fraccionado";
              const isReservaActiva = order.isReservation && order.status !== "all_paid";

              const badgeLabel = isReservaActiva
                ? "Reserva"
                : isFraccionado
                ? "Compra fraccionada"
                : "Compra directa";
              const badgeColor = isReservaActiva
                ? "bg-orange-100 text-orange-800"
                : isFraccionado
                ? "bg-purple-100 text-purple-800"
                : "bg-blue-100 text-blue-800";

              let estadoLabel = "Completado";
              let estadoColor = "bg-green-100 text-green-800";
              if (order.status === "accumulating") {
                estadoLabel = "En proceso";
                estadoColor = "bg-yellow-100 text-yellow-800";
              } else if (order.status === "lot_closed") {
                const isPickupLot = order.lotType === "fractional_pickup" || order.lotType === "fraccionado_retiro";
                estadoLabel = isPickupLot ? "Lote completo — pendiente de pago" : "A la espera de pagos";
                estadoColor = "bg-blue-100 text-blue-800";
              }

              const userAlreadyPaid =
                order.isReservation &&
                order.reservationStatus === "paid" &&
                order.status === "lot_closed";

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">

                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold text-gray-900">{order.productName}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">{order.createdAt}</p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Fabricante:</span> {order.factoryName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColor}`}>
                        {estadoLabel}
                      </span>
                      {(order.status === "all_paid" || order.status === "completed" || !order.isReservation) && (
                        <HideOrderButton itemId={order.id} label="Ocultar pedido" />
                      )}
                    </div>
                  </div>

                  {/* Info del pedido */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Cantidad</p>
                      <p className="font-semibold text-gray-900">
                        {order.qty} unidades
                        {order.purchaseCount && order.purchaseCount > 1 && (
                          <span className="text-xs text-gray-500 block">({order.purchaseCount} compras)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Modalidad</p>
                      <p className="font-semibold text-gray-900">
                        {isFraccionado
                          ? order.lotType === "fractional_shipping" || order.lotType === "fraccionado_envio"
                            ? "Fraccionado envío"
                            : "Fraccionado retiro"
                          : "Directa"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Producto</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(order.amount)}</p>
                    </div>
                    {order.status === "accumulating" && (order.shippingCostEstimated ?? 0) > 0 && (
                      <div>
                        <p className="text-gray-500">Envío estimado</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(order.shippingCostEstimated ?? 0)}
                          <span className="text-xs text-gray-400 block font-normal">(puede bajar)</span>
                        </p>
                      </div>
                    )}
                    {order.status !== "accumulating" && order.shippingCost > 0 && (
                      <div>
                        <p className="text-gray-500">Envío</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(order.shippingCost)}</p>
                      </div>
                    )}
                  </div>

                  {/* BLOQUE 2 impl 5 — Banner de costo concreto (solo lotes fraccionados activos) */}
                  {isFraccionado &&
                    order.isReservation &&
                    order.status === "lot_closed" &&
                    order.reservationStatus === "lot_closed" &&
                    (order.commissionAmount ?? 0) > 0 && (
                    <CommissionCostBanner
                      currentLevel={retailerLevel}
                      productSubtotal={order.amount}
                      commissionAmount={order.commissionAmount!}
                    />
                  )}

                  {/* Barra de progreso (solo mientras acumula) */}
                  {order.status === "accumulating" && order.lotProgress && (
                    <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-purple-900">Progreso del lote</span>
                        <span className="text-purple-700">
                          {order.lotProgress.currentQty} / {order.lotProgress.targetQty} unidades
                        </span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min(order.lotProgress.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-purple-700">
                        <span>{Math.round(order.lotProgress.percentage)}% completado</span>
                        <span>Faltan {order.lotProgress.remaining} unidades</span>
                      </div>
                    </div>
                  )}

                  {/* Tabla de beneficios/sanciones (cuando el lote cerró y no pagó aún) */}
                  {order.status === "lot_closed" && order.reservationStatus === "lot_closed" && (
                    <PaymentTiersTable lotClosedAtMs={order.lotClosedAt} />
                  )}

                  {/* Estado de pagos del lote */}
                  {order.status === "lot_closed" && order.lotMates && order.lotMates.length > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="font-medium text-blue-900 text-sm mb-3">
                        👥 Estado de pagos del lote
                      </p>
                      <div className="space-y-2">
                        {order.lotMates.map((mate, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 flex items-center gap-1.5 flex-wrap">
                              {mate.milestoneBadge && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                  {mate.milestoneBadge}
                                </span>
                              )}
                              {mate.name}
                              {mate.streakBadge && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                  {mate.streakBadge}
                                </span>
                              )}
                            </span>
                            {mate.paid ? (
                              <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                <span>✅</span> Pagó
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                                <span>⏳</span> Pendiente
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón pagar */}
                  {order.status === "lot_closed" &&
                    order.reservationStatus === "lot_closed" &&
                    order.paymentLink && (
                    <a
                      href={order.paymentLink}
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg mb-4 transition"
                    >
                      💳 Pagar ahora — {formatCurrency(order.totalFinal ?? order.amount)}
                    </a>
                  )}

                  {/* Total */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        {order.status === "accumulating" ? (
                          <>
                            <p className="text-sm text-gray-500">Total estimado</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(order.amount + (order.shippingCostEstimated ?? 0))}
                              <span className="text-xs text-gray-400 font-normal ml-1">aprox.</span>
                            </p>
                          </>
                        ) : order.status === "lot_closed" ? (
                          <>
                            <p className="text-sm text-gray-500">
                              {userAlreadyPaid ? "Total pagado" : "Total a pagar"}
                            </p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(
                                userAlreadyPaid
                                  ? (order.total || order.totalFinal || order.amount)
                                  : (order.totalFinal ?? order.amount)
                              )}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-gray-500">Total pagado</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(order.total)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mensajes de estado */}
                    {order.status === "accumulating" && order.isReservation && (
                      <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                        <span>🔖</span>
                        <span>Reserva activa — cuando el lote se complete, te mandamos el link de pago por email</span>
                      </p>
                    )}
                    {order.status === "accumulating" && !order.isReservation && (
                      <p className="text-xs text-purple-600 mt-3 flex items-center gap-1">
                        <span>⏳</span>
                        <span>Esperando a que el lote se complete</span>
                      </p>
                    )}
                    {order.status === "lot_closed" && !userAlreadyPaid && (
                      <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
                        <span>💳</span>
                        <span>
                          {order.lotType === "fractional_pickup" || order.lotType === "fraccionado_retiro"
                            ? "El lote se completó — revisá tu email para confirmar el pago de retiro en fábrica"
                            : "El lote se completó — pagá antes de que se venza el plazo para no perder tu lugar"}
                        </span>
                      </p>
                    )}
                    {order.status === "lot_closed" && userAlreadyPaid && (
                      <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                        <span>✅</span>
                        <span>Tu pago está confirmado — esperando que los demás compradores paguen</span>
                      </p>
                    )}
                    {order.status === "all_paid" && (
                      <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                        <span>✅</span>
                        <span>Lote completado — El fabricante procesará tu pedido</span>
                      </p>
                    )}
                    {!isFraccionado && (
                      <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
                        <span>📦</span>
                        <span>Compra directa completada</span>
                      </p>
                    )}

                    {/* Botón dar de baja (solo pending_lot) */}
                    {order.isReservation &&
                      order.reservationStatus === "pending_lot" &&
                      order.reservationDocId && (
                      <CancelReservationButton
                        reservationId={order.reservationDocId}
                        productName={order.productName}
                      />
                    )}

                    {/* Mensaje bloqueado si quiere cancelar en lot_closed */}
                    {order.isReservation && order.reservationStatus === "lot_closed" && (
                      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                        <span>🔒</span>
                        <span>El lote ya alcanzó el mínimo — no es posible darse de baja en esta etapa</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}