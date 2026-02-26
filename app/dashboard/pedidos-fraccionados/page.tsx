// app/dashboard/pedidos-fraccionados/page.tsx

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
};

async function DashboardRevendedorContent() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "retailer") {
    return <div className="p-6">No autorizado</div>;
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

  const orders = ordersSnap.docs.map((d) => d.data());
  const reservations = reservationsSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];

  const hiddenIds: string[] = userSnap.data()?.hiddenOrders || [];

  const userEmail = cookies().get("userEmail")?.value || userSnap.data()?.email || "";
  // ✅ NUEVO: nombre real del usuario para el saludo
  const userName =
    cookies().get("userName")?.value ||
    userSnap.data()?.name ||
    userEmail.split("@")[0] ||
    "revendedor";

  // ✅ BADGES: leer del doc retailers para el UserRoleHeader
  const retailerData = retailerSnap.data() || {};
  const milestoneBadges: string[] = retailerData.milestoneBadges ?? [];
  const streakBadges: string[] = retailerData.streakBadges ?? [];
  const currentStreak: number = retailerData.currentStreak ?? 0;

  /* ── 2. ESTADO REAL DE LOTES DESDE FIRESTORE ── */
  const allLotIds = new Set<string>();
  orders.forEach((o) => { if (o.lotId) allLotIds.add(o.lotId); });
  reservations.forEach((r) => { if (r.lotId) allLotIds.add(r.lotId); });

  const lotsRealStatus = new Map<string, {
    status: string;
    accumulatedQty: number;
    minimumOrder: number;
    type: string;
    productId: string;
  }>();

  if (allLotIds.size > 0) {
    const arr = Array.from(allLotIds);
    for (let i = 0; i < arr.length; i += 10) {
      const snap = await db
        .collection("lots")
        .where("__name__", "in", arr.slice(i, i + 10))
        .get();
      snap.docs.forEach((d) => {
        lotsRealStatus.set(d.id, {
          status: d.data().status,
          accumulatedQty: d.data().accumulatedQty || 0,
          minimumOrder: d.data().minimumOrder || d.data().MF || 0,
          type: d.data().type,
          productId: d.data().productId,
        });
      });
    }
  }

  /* ── 3. KPIs ── */
  const directOrders = orders.filter((o) => o.orderType === "directa");

  const fullyPaidLotIds = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotId) {
      if (lotsRealStatus.get(o.lotId)?.status === "fully_paid") fullyPaidLotIds.add(o.lotId);
    }
  });
  reservations.forEach((r) => {
    if (r.status === "paid" && r.lotId) {
      if (lotsRealStatus.get(r.lotId)?.status === "fully_paid") fullyPaidLotIds.add(r.lotId);
    }
  });

  const pedidosTotalesCount = directOrders.length + fullyPaidLotIds.size;

  const activeFractionalLots = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotId) {
      const realStatus = lotsRealStatus.get(o.lotId)?.status;
      if (realStatus && realStatus !== "fully_paid") activeFractionalLots.add(o.lotId);
    }
  });

  const activeReservationLots = new Set<string>();
  reservations.forEach((r) => {
    if ((r.status === "pending_lot" || r.status === "lot_closed") && r.lotId) {
      activeReservationLots.add(r.lotId);
    }
  });

  const pedidosEnProcesoCount = activeFractionalLots.size + activeReservationLots.size;

  const totalInvertido =
    orders
      .filter((o) => {
        if (o.orderType === "directa") return true;
        if (o.orderType === "fraccionado" && o.lotId) {
          return lotsRealStatus.get(o.lotId)?.status === "fully_paid";
        }
        return false;
      })
      .reduce((acc, o) => acc + (o.total || 0), 0) +
    reservations
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + (r.totalFinal || 0), 0);

  /* ── 4. LOTES EN CURSO ── */
  const lotMapFromPayments = new Map<string, {
    lotId: string;
    productId: string;
    productName: string;
    totalQty: number;
    payments: number;
  }>();

  orders
    .filter((o) => {
      if (o.orderType !== "fraccionado" || !o.lotId) return false;
      const realStatus = lotsRealStatus.get(o.lotId)?.status;
      return realStatus && realStatus !== "fully_paid";
    })
    .forEach((p) => {
      const lotId = p.lotId;
      if (lotMapFromPayments.has(lotId)) {
        const e = lotMapFromPayments.get(lotId)!;
        e.totalQty += p.qty || 0;
        e.payments += 1;
      } else {
        lotMapFromPayments.set(lotId, {
          lotId,
          productId: p.productId,
          productName: p.productName || "Producto",
          totalQty: p.qty || 0,
          payments: 1,
        });
      }
    });

  const lotMapFromReservations = new Map<string, {
    lotId: string;
    reservationDocId: string;
    productId: string;
    productName: string;
    totalQty: number;
    status: string;
    paymentLink?: string;
    totalFinal?: number;
  }>();

  reservations
    .filter((r) => r.status === "pending_lot" || r.status === "lot_closed")
    .forEach((r) => {
      if (!r.lotId || lotMapFromPayments.has(r.lotId)) return;
      if (lotMapFromReservations.has(r.lotId)) {
        lotMapFromReservations.get(r.lotId)!.totalQty += r.qty || 0;
      } else {
        lotMapFromReservations.set(r.lotId, {
          lotId: r.lotId,
          reservationDocId: r.id,
          productId: r.productId,
          productName: r.productName || "Producto",
          totalQty: r.qty || 0,
          status: r.status,
          paymentLink: r.paymentLink || null,
          totalFinal: r.totalFinal || null,
        });
      }
    });

  /* ── 5. ARMAR LISTA DE LOTES ACTIVOS ── */
  const activeLots: ActiveLot[] = [];

  for (const [lotId, ui] of lotMapFromPayments.entries()) {
    const listId = lotId;
    if (hiddenIds.includes(listId)) continue;

    const lotReal = lotsRealStatus.get(lotId);
    if (!lotReal) continue;

    activeLots.push({
      id: listId,
      productId: lotReal.productId || ui.productId,
      productName: ui.productName,
      type: lotReal.type,
      accumulatedQty: lotReal.accumulatedQty,
      minimumOrder: lotReal.minimumOrder,
      userQty: ui.totalQty,
      userPayments: ui.payments,
      progress: lotReal.minimumOrder > 0
        ? Math.min((lotReal.accumulatedQty / lotReal.minimumOrder) * 100, 100)
        : 0,
      isReservation: false,
      isPendingLot: false,
      lotClosed: lotReal.status === "closed",
    });
  }

  for (const [lotId, ui] of lotMapFromReservations.entries()) {
    const listId = `reservation-${lotId}`;
    if (hiddenIds.includes(listId)) continue;

    const lotReal = lotsRealStatus.get(lotId);
    if (!lotReal) continue;

    activeLots.push({
      id: listId,
      reservationDocId: ui.reservationDocId,
      productId: lotReal.productId || ui.productId,
      productName: ui.productName,
      type: lotReal.type,
      accumulatedQty: lotReal.accumulatedQty,
      minimumOrder: lotReal.minimumOrder,
      userQty: ui.totalQty,
      userPayments: 1,
      progress: lotReal.minimumOrder > 0
        ? Math.min((lotReal.accumulatedQty / lotReal.minimumOrder) * 100, 100)
        : 0,
      isReservation: true,
      isPendingLot: ui.status === "pending_lot",
      lotClosed: ui.status === "lot_closed" || lotReal.status === "closed",
      paymentLink: ui.paymentLink,
      totalFinal: ui.totalFinal,
    });
  }

  // Completar nombres faltantes
  const lotsWithoutName = activeLots.filter((l) => !l.productName || l.productName === "Producto");
  if (lotsWithoutName.length > 0) {
    const productIds = [...new Set(lotsWithoutName.map((l) => l.productId))];
    for (let i = 0; i < productIds.length; i += 10) {
      const snap = await db
        .collection("products")
        .where("__name__", "in", productIds.slice(i, i + 10))
        .get();
      const pm = new Map<string, string>();
      snap.docs.forEach((d) => pm.set(d.id, d.data().name));
      activeLots.forEach((l) => {
        if ((!l.productName || l.productName === "Producto") && pm.has(l.productId))
          l.productName = pm.get(l.productId)!;
      });
    }
  }

  /* ── UI ── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-10">
          <div>
            {/* ✅ CORREGIDO: muestra el nombre real del usuario */}
            <h1 className="text-3xl font-semibold">¡Bienvenido de nuevo, {userName}!</h1>
            <p className="text-gray-600 mt-1">Gestioná tus compras y pedidos</p>
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

        {/* KPIs */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Pedidos totales</p>
            <p className="text-3xl font-semibold mt-2">{pedidosTotalesCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">En proceso</p>
            <p className="text-3xl font-semibold mt-2">{pedidosEnProcesoCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Total invertido</p>
            <p className="text-3xl font-semibold mt-2">{formatCurrency(totalInvertido)}</p>
          </div>
        </div>

        {/* LOTES EN CURSO */}
        <div className="bg-white rounded-xl shadow p-6 mb-12">
          <h2 className="text-lg font-semibold mb-4">Pedidos fraccionados en curso</h2>

          {activeLots.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No tenés pedidos fraccionados en proceso actualmente.
            </p>
          ) : (
            <div className="space-y-5">
              {activeLots.map((lot) => {
                const progressPercent = Math.round(lot.progress);
                const isNearComplete = progressPercent >= 80;

                return (
                  <div key={lot.id} className="border border-gray-100 rounded-lg p-4">

                    {/* Nombre + badges + botón ocultar */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{lot.productName}</span>

                        {lot.isReservation && lot.isPendingLot && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                            Reserva
                          </span>
                        )}
                        {lot.isReservation && lot.lotClosed && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                            Esperando tu pago
                          </span>
                        )}
                        {!lot.isReservation && lot.lotClosed && (
                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded font-medium">
                            A la espera de pagos
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {lot.accumulatedQty} / {lot.minimumOrder} uds.
                        </span>
                        {!lot.isPendingLot && !lot.lotClosed && (
                          <HideOrderButton itemId={lot.id} label="Ocultar" />
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                      Tu pedido: {lot.userQty} unidades
                      {!lot.isReservation && lot.userPayments > 1 &&
                        ` en ${lot.userPayments} compras`}
                    </p>

                    {!lot.lotClosed && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${isNearComplete ? "bg-green-600" : "bg-blue-600"}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        {isNearComplete && (
                          <p className="text-xs text-green-600 mt-1">¡Cerca de completarse!</p>
                        )}
                        {lot.isReservation && lot.isPendingLot && (
                          <p className="text-xs text-orange-600 mt-1">
                            🔖 Cuando el lote se complete, te mandamos el link de pago por email
                          </p>
                        )}
                      </>
                    )}

                    {lot.lotClosed && lot.isReservation && lot.paymentLink && (
                      <div className="mt-2">
                        <p className="text-xs text-blue-700 mb-2">
                          ✅ El lote alcanzó el mínimo. Completá tu pago para confirmar la compra.
                        </p>
                        <a
                          href={lot.paymentLink}
                          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                        >
                          💳 Pagar ahora — {formatCurrency(lot.totalFinal ?? 0)}
                        </a>
                      </div>
                    )}

                    {lot.lotClosed && !lot.isReservation && (
                      <p className="text-xs text-yellow-700 mt-1">
                        ⏳ Tu pago está confirmado — esperando que los demás compradores del lote paguen
                      </p>
                    )}

                    {lot.isReservation && lot.isPendingLot && lot.reservationDocId && (
                      <CancelReservationButton
                        reservationId={lot.reservationDocId}
                        productName={lot.productName}
                      />
                    )}

                    {lot.isReservation && lot.lotClosed && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <span>🔒</span>
                        <span>El lote cerró — no es posible darse de baja en esta etapa</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* EXPLORAR */}
        <div className="grid md:grid-cols-1 gap-6 mb-12">
          <Link
            href="/explorar"
            className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2">Explorar productos</h2>
            <p className="text-gray-600 mb-4">Comprá directo o fraccionado</p>
            <span className="text-blue-600 font-medium">Ver productos →</span>
          </Link>
        </div>

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