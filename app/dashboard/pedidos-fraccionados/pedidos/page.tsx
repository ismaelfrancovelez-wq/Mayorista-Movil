// app/dashboard/pedidos-fraccionados/pedidos/page.tsx
//
// ESTADOS DE RESERVA Y LO QUE MUESTRA EL USUARIO:
//
//   "pending_lot"  → badge "Reserva" naranja + estado "En proceso" amarillo
//                    + barra de progreso del lote
//
//   "lot_closed"   → badge "Reserva" naranja + estado "A la espera de pagos" azul
//                    + lista de quién pagó y quién no
//                    + link "Pagar ahora" (el link que llegó por email)
//
//   "paid" + lote NO fully_paid → badge "Reserva" naranja + estado "A la espera de pagos" azul
//                    + lista de quién pagó y quién no (el usuario ya pagó = ✅ en la lista)
//                    SIN botón de pago (ya pagó)
//
//   "paid" + lote fully_paid  → badge "Compra fraccionada" morado + estado "Completado" verde
//
// IMPORTANTE: cuando alguien paga su reserva, se crea un "payment" en Firestore
// con isDeferredPayment:true. Ese payment NO se muestra como fila separada —
// la reserva sigue siendo la fuente de verdad para mostrar el estado.
// El payment solo existe para registrar el cobro y en el historial de pagos.

import { db } from "../../../../lib/firebase-admin";
import { cookies } from "next/headers";
import { formatCurrency } from "../../../../lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 10;

type ReservationStatus = "pending_lot" | "lot_closed" | "paid" | "cancelled";

type Pedido = {
  id: string;
  productId: string;
  productName: string;
  factoryName: string;
  qty: number;
  orderType: "directa" | "fraccionado";
  lotType?: string;
  lotId?: string;
  isReservation?: boolean;
  reservationStatus?: ReservationStatus;
  lotMates?: {
    name: string;
    paid: boolean;
  }[];
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
  lotProgress?: {
    currentQty: number;
    targetQty: number;
    percentage: number;
    remaining: number;
  };
};

async function getRetailerOrders(retailerId: string): Promise<Pedido[]> {

  // ── Traemos payments Y reservas en paralelo ──────────────────────────────
  const [paymentsSnap, myReservationsSnap] = await Promise.all([
    db.collection("payments").where("retailerId", "==", retailerId).limit(50).get(),
    db.collection("reservations")
      .where("retailerId", "==", retailerId)
      .where("status", "in", ["pending_lot", "lot_closed", "paid"])
      .limit(50)
      .get(),
  ]);

  // ── Juntar todos los lotIds que necesitamos consultar ────────────────────
  const lotIds = new Set<string>();
  paymentsSnap.docs.forEach((d) => { if (d.data().lotId) lotIds.add(d.data().lotId); });
  myReservationsSnap.docs.forEach((d) => { if (d.data().lotId) lotIds.add(d.data().lotId); });

  // ── Batch query: estado real de todos los lotes desde Firestore ──────────
  const lotsMap = new Map<string, { status: string; accumulatedQty: number; minimumOrder: number }>();
  if (lotIds.size > 0) {
    const arr = Array.from(lotIds);
    for (let i = 0; i < arr.length; i += 10) {
      const snap = await db.collection("lots").where("__name__", "in", arr.slice(i, i + 10)).get();
      snap.docs.forEach((d) => {
        lotsMap.set(d.id, {
          status: d.data().status,
          accumulatedQty: d.data().accumulatedQty || 0,
          minimumOrder: d.data().minimumOrder || d.data().minimumQty || 0,
        });
      });
    }
  }

  // ── Para lotes cerrados: obtener el estado de pago de TODOS los compradores ──
  const lotIdsNeedingMates = new Set<string>();
  myReservationsSnap.docs.forEach((d) => {
    const r = d.data();
    if ((r.status === "lot_closed" || r.status === "paid") && r.lotId) {
      lotIdsNeedingMates.add(r.lotId);
    }
  });

  const lotMatesMap = new Map<string, { name: string; paid: boolean }[]>();
  if (lotIdsNeedingMates.size > 0) {
    for (const lotId of Array.from(lotIdsNeedingMates)) {
      const allResSnap = await db
        .collection("reservations")
        .where("lotId", "==", lotId)
        .where("status", "in", ["lot_closed", "paid"])
        .get();

      const mates = allResSnap.docs.map((d) => ({
        name: d.data().retailerName || "Comprador",
        paid: d.data().status === "paid",
      }));
      lotMatesMap.set(lotId, mates);
    }
  }

  // Helper: barra de progreso del lote
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

  // ── PASO 1: RESERVAS (fuente de verdad para el flujo diferido) ───────────
  //
  // Procesamos primero las reservas. Guardamos los lotIds ya cubiertos
  // para no mostrarlos de nuevo desde payments.
  const reservationLotIds = new Set<string>();
  const reservationOrders: Pedido[] = [];

  for (const resDoc of myReservationsSnap.docs) {
    const r = resDoc.data();
    if (!r.lotId || r.status === "cancelled") continue;

    // Marcar este lotId como "ya procesado por reserva"
    reservationLotIds.add(r.lotId);

    const resStatus = r.status as ReservationStatus;
    const mates = lotMatesMap.get(r.lotId) || [];
    const unpaidCount = mates.filter((m) => !m.paid).length;
    const allPaid = mates.length > 0 && unpaidCount === 0;

    // ── Estado visual ─────────────────────────────────────────────────────
    // pending_lot              → accumulating  (esperando cierre del lote)
    // lot_closed               → lot_closed    (lote cerró, usuario aún no pagó)
    // paid + otros sin pagar   → lot_closed    (usuario ya pagó, otros no)
    // paid + todos pagaron     → all_paid      (completado)
    let pedidoStatus: Pedido["status"] = "accumulating";
    if (resStatus === "lot_closed") {
      pedidoStatus = "lot_closed";
    } else if (resStatus === "paid") {
      pedidoStatus = allPaid ? "all_paid" : "lot_closed";
    }

    const shippingFinal = r.shippingCostFinal ?? r.shippingCostEstimated ?? 0;

    reservationOrders.push({
      id: `reservation-${resDoc.id}`,
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
      // Solo mostrar link de pago si el usuario TODAVÍA NO pagó (status = lot_closed)
      paymentLink: resStatus === "lot_closed" ? (r.paymentLink || null) : null,
      totalFinal: r.totalFinal || null,
      status: pedidoStatus,
      amount: r.productSubtotal || 0,
      shippingCost: (resStatus === "paid" || resStatus === "lot_closed") ? shippingFinal : 0,
      shippingCostEstimated: r.shippingCostEstimated || 0,
      total: resStatus === "paid" ? (r.totalFinal || 0) : 0,
      createdAt: r.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      createdAtTimestamp: r.createdAt?.toMillis() || 0,
      lotProgress: resStatus === "pending_lot" ? buildLotProgress(r.lotId) : undefined,
    });
  }

  // ── PASO 2: PAYMENTS normales (fraccionados sin reserva + directos) ──────
  //
  // Si un lotId ya está cubierto por una reserva → saltarlo completamente.
  // Esto incluye los pagos isDeferredPayment (reservas diferidas ya pagadas).
  const fractionalGrouped = new Map<string, { payments: any[]; totalQty: number; totalAmount: number; totalShipping: number; totalTotal: number; oldestDate: number; latestDate: number }>();
  const directOrders: Pedido[] = [];

  for (const paymentDoc of paymentsSnap.docs) {
    const p = paymentDoc.data();

    if (p.orderType === "directa") {
      directOrders.push({
        id: paymentDoc.id,
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
      // ✅ Si este lotId ya tiene una reserva → NO procesar el payment acá
      if (reservationLotIds.has(p.lotId)) continue;

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
    const status: Pedido["status"] = lotData?.status === "fully_paid" ? "all_paid" : "accumulating";

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

  const orders = await getRetailerOrders(userId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Pedidos</h1>
          <p className="text-gray-600">Últimos 50 pedidos (actualizado cada 10 segundos)</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500 text-lg mb-4">No tienes pedidos todavía</p>
            <a href="/explorar" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Explorar productos
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isFraccionado = order.orderType === "fraccionado";

              // Badge de TIPO:
              // "Reserva" mientras no todos hayan pagado (aunque el usuario ya pagó)
              // "Compra fraccionada" solo cuando TODOS pagaron
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

              // Badge de ESTADO:
              let estadoLabel = "Completado";
              let estadoColor = "bg-green-100 text-green-800";
              if (order.status === "accumulating") {
                estadoLabel = "En proceso";
                estadoColor = "bg-yellow-100 text-yellow-800";
              } else if (order.status === "lot_closed") {
                estadoLabel = "A la espera de pagos";
                estadoColor = "bg-blue-100 text-blue-800";
              }

              // ¿El usuario ya pagó su reserva pero otros no pagaron aún?
              const userAlreadyPaid =
                order.isReservation &&
                order.reservationStatus === "paid" &&
                order.status === "lot_closed";

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
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
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColor}`}>
                      {estadoLabel}
                    </span>
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

                  {/* ── BARRA DE PROGRESO (solo mientras acumula) ── */}
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

                  {/* ── ESTADO DE PAGOS DEL LOTE (cuando el lote cerró) ── */}
                  {order.status === "lot_closed" && order.lotMates && order.lotMates.length > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="font-medium text-blue-900 text-sm mb-3">
                        👥 Estado de pagos del lote
                      </p>
                      <div className="space-y-2">
                        {order.lotMates.map((mate, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{mate.name}</span>
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

                  {/* ── BOTÓN PAGAR (solo si el usuario NO pagó todavía) ── */}
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

                  {/* ── TOTAL ── */}
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
                        <span>El lote se completó — usá el botón de arriba para confirmar tu compra</span>
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