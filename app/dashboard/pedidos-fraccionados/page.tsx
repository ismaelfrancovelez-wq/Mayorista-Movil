// app/dashboard/pedidos-fraccionados/page.tsx
//
// ✅ MODIFICACIÓN: Ahora lee también de "reservations" para mostrar
//    las reservas activas en "Pedidos fraccionados en curso" con barra de progreso.
//
// REGLAS:
//   - Reservas "pending_lot" o "notified" → aparecen en "en curso" con barra
//   - Reservas "paid" → cuentan como pedido completado en los KPIs
//   - El resto del código es idéntico al original

import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import ActiveRoleBadge from "../../../components/ActiveRoleBadge";
import SwitchRoleButton from "../../../components/SwitchRoleButton";
import Link from "next/link";
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react";
import { DashboardSkeleton } from "../../../components/DashboardSkeleton";

export const dynamic = "force-dynamic";
export const revalidate = 10;

type ActiveLot = {
  id: string;
  productId: string;
  productName: string;
  type: string;
  accumulatedQty: number;
  minimumOrder: number;
  userQty: number;
  progress: number;
  userPayments: number;
  // ✅ NUEVO: distinguir reservas de pagos normales
  isReservation?: boolean;
};

async function DashboardRevendedorContent() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "retailer") {
    return <div className="p-6">No autorizado</div>;
  }

  /* ─── PEDIDOS (payments) y RESERVAS en paralelo ─── */
  const [ordersSnap, reservationsSnap] = await Promise.all([
    db.collection("payments").where("buyerId", "==", userId).limit(100).get(),
    db
      .collection("reservations")
      .where("retailerId", "==", userId)
      .where("status", "in", ["pending_lot", "notified", "paid"])
      .limit(100)
      .get(),
  ]);

  const orders = ordersSnap.docs.map((doc) => doc.data());
  const reservations = reservationsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

  /* ─── KPIs ─── */

  // Pedidos directos pagados
  const directOrders = orders.filter((o) => o.orderType === "directa");

  // Lotes fraccionados cerrados (pagados)
  const closedLotIds = new Set<string>();
  orders.forEach((o) => {
    if (o.orderType === "fraccionado" && o.lotStatus === "closed" && o.lotId) {
      closedLotIds.add(o.lotId);
    }
  });

  // Reservas pagadas (cuentan como pedido completado)
  const reservasPagadasLotIds = new Set<string>();
  reservations.forEach((r) => {
    if (r.status === "paid" && r.lotId) {
      reservasPagadasLotIds.add(r.lotId);
    }
  });

  const pedidosTotalesCount =
    directOrders.length + closedLotIds.size + reservasPagadasLotIds.size;

  // Pedidos fraccionados en proceso (pagos normales aún acumulando)
  const pedidosEnProcesoPayments = orders.filter(
    (o) => o.orderType === "fraccionado" && o.lotStatus !== "closed"
  );

  // Reservas activas (sin pagar todavía)
  const reservasActivas = reservations.filter(
    (r) => r.status === "pending_lot" || r.status === "notified"
  );

  // KPI "en proceso" = fraccionados acumulando + reservas activas
  // (usamos Sets para no duplicar si hay tanto payment como reserva del mismo lote)
  const enProcesoLotIds = new Set<string>();
  pedidosEnProcesoPayments.forEach((o) => {
    if (o.lotId) enProcesoLotIds.add(o.lotId);
  });
  reservasActivas.forEach((r) => {
    if (r.lotId) enProcesoLotIds.add(r.lotId);
  });
  const pedidosEnProcesoCount = enProcesoLotIds.size;

  // Total invertido = directas + fraccionados cerrados + reservas pagadas
  const totalInvertido =
    orders
      .filter(
        (o) =>
          o.orderType === "directa" ||
          (o.orderType === "fraccionado" && o.lotStatus === "closed")
      )
      .reduce((acc, o) => acc + (o.total || 0), 0) +
    reservations
      .filter((r) => r.status === "paid")
      .reduce((acc, r) => acc + (r.totalFinal || 0), 0);

  /* ─── LOTES ACTIVOS (payments normales) ─── */
  const activeFractionalPayments = orders.filter(
    (o) =>
      o.orderType === "fraccionado" && o.lotId && o.lotStatus === "accumulating"
  );

  const lotMapFromPayments = new Map<
    string,
    {
      lotId: string;
      productId: string;
      productName: string;
      totalQty: number;
      payments: number;
    }
  >();

  activeFractionalPayments.forEach((payment) => {
    const lotId = payment.lotId;
    if (!lotId) return;
    if (lotMapFromPayments.has(lotId)) {
      const existing = lotMapFromPayments.get(lotId)!;
      existing.totalQty += payment.qty || 0;
      existing.payments += 1;
    } else {
      lotMapFromPayments.set(lotId, {
        lotId,
        productId: payment.productId,
        productName: payment.productName || "Producto",
        totalQty: payment.qty || 0,
        payments: 1,
      });
    }
  });

  /* ─── RESERVAS ACTIVAS (pending_lot / notified) ─── */
  const lotMapFromReservations = new Map<
    string,
    {
      lotId: string;
      productId: string;
      productName: string;
      totalQty: number;
    }
  >();

  reservasActivas.forEach((r) => {
    if (!r.lotId) return;
    // Si ya hay un payment normal para este lote, no duplicar
    if (lotMapFromPayments.has(r.lotId)) return;

    if (lotMapFromReservations.has(r.lotId)) {
      lotMapFromReservations.get(r.lotId)!.totalQty += r.qty || 0;
    } else {
      lotMapFromReservations.set(r.lotId, {
        lotId: r.lotId,
        productId: r.productId,
        productName: r.productName || "Producto",
        totalQty: r.qty || 0,
      });
    }
  });

  /* ─── Juntar todos los lotIds para batch query ─── */
  const allActiveLotIds = [
    ...Array.from(lotMapFromPayments.keys()),
    ...Array.from(lotMapFromReservations.keys()),
  ];

  const activeLots: ActiveLot[] = [];

  if (allActiveLotIds.length > 0) {
    for (let i = 0; i < allActiveLotIds.length; i += 10) {
      const batch = allActiveLotIds.slice(i, i + 10);
      const lotsSnap = await db
        .collection("lots")
        .where("__name__", "in", batch)
        .get();

      for (const lotDoc of lotsSnap.docs) {
        const data = lotDoc.data();
        const lotId = lotDoc.id;

        // ── Lote desde payment normal ──
        if (lotMapFromPayments.has(lotId)) {
          const userInfo = lotMapFromPayments.get(lotId)!;
          activeLots.push({
            id: lotId,
            productId: data.productId,
            productName: userInfo.productName,
            type: data.type,
            accumulatedQty: data.accumulatedQty || 0,
            minimumOrder: data.minimumOrder || data.MF || 0,
            userQty: userInfo.totalQty,
            userPayments: userInfo.payments,
            progress:
              data.minimumOrder > 0
                ? Math.min(
                    (data.accumulatedQty / data.minimumOrder) * 100,
                    100
                  )
                : 0,
            isReservation: false,
          });
        }

        // ── Lote desde reserva ──
        if (lotMapFromReservations.has(lotId)) {
          const userInfo = lotMapFromReservations.get(lotId)!;
          activeLots.push({
            id: `reservation-${lotId}`,
            productId: data.productId,
            productName: userInfo.productName,
            type: data.type,
            accumulatedQty: data.accumulatedQty || 0,
            minimumOrder: data.minimumOrder || data.MF || 0,
            userQty: userInfo.totalQty,
            userPayments: 1,
            progress:
              data.minimumOrder > 0
                ? Math.min(
                    (data.accumulatedQty / data.minimumOrder) * 100,
                    100
                  )
                : 0,
            isReservation: true,
          });
        }
      }
    }

    // Completar nombres de productos que faltan
    const lotsWithoutName = activeLots.filter(
      (l) => !l.productName || l.productName === "Producto"
    );
    if (lotsWithoutName.length > 0) {
      const productIds = [
        ...new Set(lotsWithoutName.map((l) => l.productId)),
      ];
      for (let i = 0; i < productIds.length; i += 10) {
        const batch = productIds.slice(i, i + 10);
        const productsSnap = await db
          .collection("products")
          .where("__name__", "in", batch)
          .get();
        const productsMap = new Map<string, string>();
        productsSnap.docs.forEach((doc) => {
          productsMap.set(doc.id, doc.data().name);
        });
        activeLots.forEach((lot) => {
          if (
            (!lot.productName || lot.productName === "Producto") &&
            productsMap.has(lot.productId)
          ) {
            lot.productName = productsMap.get(lot.productId)!;
          }
        });
      }
    }
  }

  /* ─── UI ─── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-semibold">
              Dashboard del revendedor
            </h1>
            <p className="text-gray-600 mt-1">
              Gestioná tus compras y pedidos
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ActiveRoleBadge />
            <SwitchRoleButton targetRole="manufacturer" />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Pedidos totales</p>
            <p className="text-3xl font-semibold mt-2">
              {pedidosTotalesCount}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">En proceso</p>
            <p className="text-3xl font-semibold mt-2">
              {pedidosEnProcesoCount}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Total invertido</p>
            <p className="text-3xl font-semibold mt-2">
              {formatCurrency(totalInvertido)}
            </p>
          </div>
        </div>

        {/* LOTES ACTIVOS (payments + reservas) */}
        <div className="bg-white rounded-xl shadow p-6 mb-12">
          <h2 className="text-lg font-semibold mb-4">
            Pedidos fraccionados en curso
          </h2>

          {activeLots.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No tenés pedidos fraccionados en proceso actualmente.
            </p>
          ) : (
            <div className="space-y-4">
              {activeLots.map((lot) => {
                const progressPercent = Math.round(lot.progress);
                const isNearComplete = progressPercent >= 80;

                return (
                  <div key={lot.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <div>
                        <span className="font-medium">{lot.productName}</span>
                        {/* ✅ Badge "Reserva" para las reservas */}
                        {lot.isReservation && (
                          <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                            Reserva
                          </span>
                        )}
                        <span className="text-xs text-gray-500 ml-2">
                          (Tu pedido: {lot.userQty} unidades
                          {!lot.isReservation &&
                            lot.userPayments > 1 &&
                            ` en ${lot.userPayments} compras`}
                          )
                        </span>
                      </div>
                      <span className="text-gray-500">
                        {lot.accumulatedQty} / {lot.minimumOrder}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          isNearComplete ? "bg-green-600" : "bg-blue-600"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {isNearComplete && (
                      <p className="text-xs text-green-600 mt-1">
                        ¡Cerca de completarse!
                      </p>
                    )}

                    {/* ✅ Aviso para reservas: cuando cierre, te mandamos el link */}
                    {lot.isReservation && (
                      <p className="text-xs text-orange-600 mt-1">
                        🔖 Reserva activa — cuando el lote se complete, te
                        mandamos el link de pago por email
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* EXPLORAR PRODUCTOS */}
        <div className="grid md:grid-cols-1 gap-6 mb-12">
          <Link
            href="/explorar"
            className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2">
              Explorar productos
            </h2>
            <p className="text-gray-600 mb-4">
              Comprá directo o fraccionado
            </p>
            <span className="text-blue-600 font-medium">
              Ver productos →
            </span>
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