// app/dashboard/pedidos-fraccionados/pedidos/page.tsx
//
// ✅ MODIFICACIÓN: Ahora lee tanto de "payments" (compras ya pagadas)
//    como de "reservations" (reservas sin pagar aún).
//
// REGLAS DE VISUALIZACIÓN:
//   - Reserva con status "pending_lot" o "notified" → badge "Reserva" (naranja),
//     estado "En proceso" (amarillo), barra de progreso del lote
//   - Reserva con status "paid" → badge "Compra fraccionada" (morado),
//     estado "Completado" (verde)
//   - Pagos normales → comportamiento idéntico al original
//
// NO SE MODIFICÓ nada del flujo de pagos normales.

import { db } from "../../../../lib/firebase-admin";
import { cookies } from "next/headers";
import { formatCurrency } from "../../../../lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 10;

/* ====================================================
   TIPOS
==================================================== */
type Pedido = {
  id: string;
  productId: string;
  productName: string;
  factoryName: string;
  qty: number;
  orderType: "directa" | "fraccionado";
  lotType?: string;
  lotId?: string;
  // ✅ NUEVO: distinguir reservas de compras pagadas
  isReservation?: boolean;
  reservationStatus?: "pending_lot" | "notified" | "paid" | "cancelled";
  status: "accumulating" | "closed" | "completed";
  amount: number;
  shippingCost: number;
  total: number;
  // ✅ Para reservas: mostrar el estimado, no el total pagado
  shippingCostEstimated?: number;
  createdAt: string;
  createdAtTimestamp: number;
  purchaseCount?: number;
  lotProgress?: {
    currentQty: number;
    targetQty: number;
    percentage: number;
    remaining: number;
  };
};

/* ====================================================
   OBTENER PEDIDOS + RESERVAS
==================================================== */
async function getRetailerOrders(retailerId: string): Promise<Pedido[]> {
  // ── Consultar payments y reservations en paralelo ──
  const [paymentsSnap, reservationsSnap] = await Promise.all([
    db
      .collection("payments")
      .where("retailerId", "==", retailerId)
      .limit(50)
      .get(),
    db
      .collection("reservations")
      .where("retailerId", "==", retailerId)
      .where("status", "in", ["pending_lot", "notified", "paid"])
      .limit(50)
      .get(),
  ]);

  // ── Juntar todos los lotIds que necesitamos consultar ──
  const lotIds = new Set<string>();

  paymentsSnap.docs.forEach((doc) => {
    const p = doc.data();
    if (p.lotId) lotIds.add(p.lotId);
  });
  reservationsSnap.docs.forEach((doc) => {
    const r = doc.data();
    if (r.lotId) lotIds.add(r.lotId);
  });

  // ── Batch query para todos los lotes ──
  const lotsMap = new Map<
    string,
    { status: string; accumulatedQty: number; minimumOrder: number }
  >();

  if (lotIds.size > 0) {
    const lotIdsArray = Array.from(lotIds);
    for (let i = 0; i < lotIdsArray.length; i += 10) {
      const batch = lotIdsArray.slice(i, i + 10);
      const lotsSnap = await db
        .collection("lots")
        .where("__name__", "in", batch)
        .get();
      lotsSnap.docs.forEach((doc) => {
        const data = doc.data();
        lotsMap.set(doc.id, {
          status: data.status,
          accumulatedQty: data.accumulatedQty || 0,
          minimumOrder: data.minimumOrder || data.minimumQty || 0,
        });
      });
    }
  }

  /* ── HELPER: construir lotProgress ── */
  function buildLotProgress(lotId: string | undefined) {
    if (!lotId) return undefined;
    const lotData = lotsMap.get(lotId);
    if (!lotData || !lotData.minimumOrder) return undefined;
    const currentQty = lotData.accumulatedQty;
    const targetQty = lotData.minimumOrder;
    return {
      currentQty,
      targetQty,
      percentage: Math.min((currentQty / targetQty) * 100, 100),
      remaining: Math.max(targetQty - currentQty, 0),
    };
  }

  /* ================================================================
     PROCESAR PAYMENTS (lógica original — sin tocar)
  ================================================================ */
  const fractionalGrouped = new Map<
    string,
    {
      payments: any[];
      totalQty: number;
      totalAmount: number;
      totalShipping: number;
      totalTotal: number;
      oldestDate: number;
      latestDate: number;
    }
  >();

  const directOrders: Pedido[] = [];

  for (const paymentDoc of paymentsSnap.docs) {
    const payment = paymentDoc.data();

    if (payment.orderType === "directa") {
      directOrders.push({
        id: paymentDoc.id,
        productId: payment.productId,
        productName: payment.productName || "Producto",
        factoryName: payment.factoryName || "Fabricante",
        qty: payment.qty || 0,
        orderType: "directa",
        status: "completed",
        amount: payment.amount || 0,
        shippingCost: payment.shippingCost || 0,
        total: payment.total || 0,
        createdAt:
          payment.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
        createdAtTimestamp: payment.createdAt?.toMillis() || 0,
      });
    } else if (payment.orderType === "fraccionado" && payment.lotId) {
      const lotId = payment.lotId;
      if (fractionalGrouped.has(lotId)) {
        const group = fractionalGrouped.get(lotId)!;
        group.payments.push(payment);
        group.totalQty += payment.qty || 0;
        group.totalAmount += payment.amount || 0;
        group.totalShipping += payment.shippingCost || 0;
        group.totalTotal += payment.total || 0;
        group.latestDate = Math.max(
          group.latestDate,
          payment.createdAt?.toMillis() || 0
        );
        group.oldestDate = Math.min(
          group.oldestDate,
          payment.createdAt?.toMillis() || 0
        );
      } else {
        fractionalGrouped.set(lotId, {
          payments: [payment],
          totalQty: payment.qty || 0,
          totalAmount: payment.amount || 0,
          totalShipping: payment.shippingCost || 0,
          totalTotal: payment.total || 0,
          oldestDate: payment.createdAt?.toMillis() || 0,
          latestDate: payment.createdAt?.toMillis() || 0,
        });
      }
    }
  }

  const fraccionadoOrders: Pedido[] = [];
  for (const [lotId, group] of fractionalGrouped.entries()) {
    const firstPayment = group.payments[0];
    const lotData = lotsMap.get(lotId);
    let status: Pedido["status"] = "completed";
    if (lotData) {
      status = lotData.status === "closed" ? "closed" : "accumulating";
    }
    fraccionadoOrders.push({
      id: lotId,
      productId: firstPayment.productId,
      productName: firstPayment.productName || "Producto",
      factoryName: firstPayment.factoryName || "Fabricante",
      qty: group.totalQty,
      orderType: "fraccionado",
      lotType: firstPayment.lotType,
      lotId,
      status,
      amount: group.totalAmount,
      shippingCost: group.totalShipping,
      total: group.totalTotal,
      purchaseCount: group.payments.length,
      createdAt: new Date(group.oldestDate).toLocaleDateString("es-AR"),
      createdAtTimestamp: group.latestDate,
      lotProgress: buildLotProgress(lotId),
    });
  }

  /* ================================================================
     PROCESAR RESERVATIONS
     ✅ NUEVO — reservas sin pagar o ya pagadas
  ================================================================ */
  const reservationOrders: Pedido[] = [];

  // Agrupar por lotId (igual que los pagos fraccionados)
  const reservationByLot = new Map<string, typeof reservationsSnap.docs>();

  for (const resDoc of reservationsSnap.docs) {
    const r = resDoc.data();
    // Reservas canceladas o sin lote → ignorar
    if (r.status === "cancelled" || !r.lotId) continue;

    const lotId = r.lotId;
    if (!reservationByLot.has(lotId)) {
      reservationByLot.set(lotId, []);
    }
    reservationByLot.get(lotId)!.push(resDoc);
  }

  for (const [lotId, docs] of reservationByLot.entries()) {
    const firstRes = docs[0].data();
    const lotData = lotsMap.get(lotId);

    // Si hay un pago fraccionado normal para el mismo lote,
    // no duplicar (el pago ya cubre esta reserva)
    if (fractionalGrouped.has(lotId)) continue;

    // Estado de la reserva
    const resStatus = firstRes.status as
      | "pending_lot"
      | "notified"
      | "paid"
      | "cancelled";
    const isPaid = resStatus === "paid";

    // Si está pagada, la mostramos como "compra fraccionada completada"
    // Si no, la mostramos como "reserva en proceso"
    let status: Pedido["status"] = isPaid ? "closed" : "accumulating";
    if (lotData?.status === "closed" && !isPaid) {
      // El lote cerró pero aún no pagó → sigue en proceso (esperando pago)
      status = "accumulating";
    }

    const totalQty = docs.reduce((acc, d) => acc + (d.data().qty || 0), 0);
    const totalAmount = docs.reduce(
      (acc, d) => acc + (d.data().productSubtotal || 0),
      0
    );
    const shippingEstimated = firstRes.shippingCostEstimated || 0;
    const shippingFinal = firstRes.shippingCostFinal || shippingEstimated;

    reservationOrders.push({
      id: `reservation-${lotId}`,
      productId: firstRes.productId,
      productName: firstRes.productName || "Producto",
      factoryName: firstRes.factoryName || "Fabricante",
      qty: totalQty,
      orderType: "fraccionado",
      lotType:
        firstRes.shippingMode === "pickup"
          ? "fraccionado_retiro"
          : "fraccionado_envio",
      lotId,
      isReservation: true,
      reservationStatus: resStatus,
      status,
      amount: totalAmount,
      shippingCost: isPaid ? shippingFinal : 0, // antes de pagar no mostrar envío como "pagado"
      shippingCostEstimated: shippingEstimated,
      total: isPaid
        ? (firstRes.totalFinal || totalAmount + shippingFinal)
        : 0,
      createdAt:
        firstRes.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      createdAtTimestamp: firstRes.createdAt?.toMillis() || 0,
      lotProgress: buildLotProgress(lotId),
    });
  }

  /* ── Combinar todo y ordenar ── */
  const allOrders = [
    ...fraccionadoOrders,
    ...reservationOrders,
    ...directOrders,
  ];
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
          <p className="text-red-600">
            Debes tener rol de revendedor para acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  const orders = await getRetailerOrders(userId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Mis Pedidos
          </h1>
          <p className="text-gray-600">
            Últimos 50 pedidos (actualizado cada 10 segundos)
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 text-lg mb-4">
              No tienes pedidos todavía
            </p>
            <p className="text-gray-400 mb-6">
              Empieza a comprar productos al por mayor
            </p>
            <a
              href="/explorar"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Explorar productos
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isFraccionado = order.orderType === "fraccionado";

              // ── Es una reserva aún no pagada ──
              const isReservaActiva =
                order.isReservation &&
                (order.reservationStatus === "pending_lot" ||
                  order.reservationStatus === "notified");

              // ── Es una reserva ya pagada (se muestra como compra completada) ──
              const isReservaPagada =
                order.isReservation && order.reservationStatus === "paid";

              // ── Fraccionado normal en proceso (sin reserva) ──
              const isFraccionadoEnProceso =
                isFraccionado && !order.isReservation && order.status === "accumulating";

              // ── En proceso = reserva activa O fraccionado acumulando ──
              const isEnProceso = isReservaActiva || isFraccionadoEnProceso;

              // ── Badge del tipo de pedido ──
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

              // ── Badge de estado ──
              const estadoLabel = isEnProceso ? "En proceso" : "Completado";
              const estadoColor = isEnProceso
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800";

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {order.productName}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${badgeColor}`}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">
                        {order.createdAt}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Fabricante:</span>{" "}
                        {order.factoryName}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColor}`}
                    >
                      {estadoLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Cantidad</p>
                      <p className="font-semibold text-gray-900">
                        {order.qty} unidades
                        {order.purchaseCount && order.purchaseCount > 1 && (
                          <span className="text-xs text-gray-500 block">
                            ({order.purchaseCount} compras)
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">Modalidad</p>
                      <p className="font-semibold text-gray-900">
                        {isFraccionado
                          ? order.lotType === "fractional_shipping" ||
                            order.lotType === "fraccionado_envio"
                            ? "Fraccionado envío"
                            : "Fraccionado retiro"
                          : "Directa"}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">Producto</p>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(order.amount)}
                      </p>
                    </div>

                    {/* Envío: para reservas activas mostrar estimado con aviso */}
                    {isReservaActiva && (order.shippingCostEstimated ?? 0) > 0 && (
                      <div>
                        <p className="text-gray-500">Envío estimado</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(order.shippingCostEstimated ?? 0)}
                          <span className="text-xs text-gray-400 block font-normal">
                            (puede bajar)
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Envío: para pagos normales o reservas pagadas */}
                    {!isReservaActiva && order.shippingCost > 0 && (
                      <div>
                        <p className="text-gray-500">Envío</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(order.shippingCost)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ── BARRA DE PROGRESO DEL LOTE ── */}
                  {/* Aparece para reservas activas Y fraccionados normales en proceso */}
                  {isEnProceso && order.lotProgress && (
                    <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-purple-900">
                          Progreso del lote
                        </span>
                        <span className="text-purple-700">
                          {order.lotProgress.currentQty} /{" "}
                          {order.lotProgress.targetQty} unidades
                        </span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-purple-600 h-3 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              order.lotProgress.percentage,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-purple-700">
                        <span>
                          {Math.round(order.lotProgress.percentage)}% completado
                        </span>
                        <span>
                          Faltan {order.lotProgress.remaining} unidades
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        {isReservaActiva ? (
                          <>
                            <p className="text-sm text-gray-500">
                              Total estimado
                            </p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(
                                order.amount +
                                  (order.shippingCostEstimated ?? 0)
                              )}
                              <span className="text-xs text-gray-400 font-normal ml-1">
                                aprox.
                              </span>
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-gray-500">
                              Total pagado
                            </p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(order.total)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mensajes de estado abajo */}
                    {isReservaActiva && (
                      <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                        <span>🔖</span>
                        <span>
                          Reserva activa — cuando el lote se complete, te
                          mandamos el link de pago por email
                        </span>
                      </p>
                    )}
                    {isReservaPagada && (
                      <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                        <span>✅</span>
                        <span>
                          Lote completado — El fabricante procesará tu pedido
                        </span>
                      </p>
                    )}
                    {isFraccionadoEnProceso && (
                      <p className="text-xs text-purple-600 mt-3 flex items-center gap-1">
                        <span>⏳</span>
                        <span>Esperando a que el lote se complete</span>
                      </p>
                    )}
                    {isFraccionado &&
                      !isReservaActiva &&
                      !isReservaPagada &&
                      !isFraccionadoEnProceso && (
                        <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                          <span>✅</span>
                          <span>
                            Lote completado — El fabricante procesará tu pedido
                          </span>
                        </p>
                      )}
                    {!isFraccionado && (
                      <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
                        <span>📦</span>
                        <span>Compra directa completada</span>
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