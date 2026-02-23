import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import Link from "next/link";
import UserRoleHeader from "../../../components/UserRoleHeader"; // ✅ NUEVO (reemplaza ActiveRoleBadge + SwitchRoleButton)
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react";
import { DashboardSkeleton } from "../../../components/DashboardSkeleton";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function DashboardFabricanteContent() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;
  const userEmail = cookies().get("userEmail")?.value || ""; // ✅ NUEVO

  if (!userId || role !== "manufacturer") {
    return <div className="p-6">No autorizado</div>;
  }

  /* ===============================
     💳 LOTES CERRADOS (FRACCIONADOS COMPLETADOS)
  =============================== */
  
  // ✅ LOTES CERRADOS (sin orderBy para evitar índice)
  const lotsSnap = await db
    .collection("lots")
    .where("factoryId", "==", userId)
    .where("status", "==", "closed")
    .get();

  const closedLots: Array<{
    id: string;
    productId: string;
    productName: string;
    qty: number;
    pricePerUnit: number;
    total: number;
    ganancia: number;
    closedAt: string;
    closedAtTimestamp: number;
  }> = [];

  for (const lotDoc of lotsSnap.docs) {
    const lotData = lotDoc.data();
    
    // ✅ Intentar obtener producto (puede no existir si fue borrado)
    const productDoc = await db.collection("products").doc(lotData.productId).get();
    const productData = productDoc.exists ? productDoc.data() : null;
    
    // ✅ PRIORIDAD: Usar datos guardados en el lote (si existen), sino buscar en producto
    const productName = lotData.productName || productData?.name || "Producto eliminado";
    const productPrice = lotData.productPrice || productData?.price || 0;
    const netProfitPerUnit = lotData.netProfitPerUnit || productData?.netProfitPerUnit || 0;
    
    const accumulatedQty = lotData.accumulatedQty || 0;
    const totalIngresos = accumulatedQty * productPrice;
    const ganancia = accumulatedQty * netProfitPerUnit;
    
    closedLots.push({
      id: lotDoc.id,
      productId: lotData.productId,
      productName: productName,  // ✅ Usar variable calculada arriba
      qty: accumulatedQty,
      pricePerUnit: productPrice,
      total: totalIngresos,
      ganancia: ganancia,
      closedAt: lotData.closedAt?.toDate().toLocaleDateString("es-AR") || "-",
      closedAtTimestamp: lotData.closedAt?.toMillis() || 0,
    });
  }

  /* ===============================
     🚚 PEDIDOS DIRECTOS COMPLETADOS
  =============================== */
  
  const directOrdersSnap = await db
    .collection("payments")
    .where("factoryId", "==", userId)
    .where("orderType", "==", "directa")
    .where("status", "==", "approved")
    .orderBy("createdAt", "desc")
    .get();

  const directOrders: Array<{
    id: string;
    productId: string;
    productName: string;
    qty: number;
    pricePerUnit: number;
    total: number;
    ganancia: number;
    closedAt: string;
    closedAtTimestamp: number;
  }> = [];

  for (const paymentDoc of directOrdersSnap.docs) {
    const payment = paymentDoc.data();
    
    // ✅ Intentar obtener producto (puede no existir si fue borrado)
    const productDoc = await db.collection("products").doc(payment.productId).get();
    const productData = productDoc.exists ? productDoc.data() : null;
    
    // ✅ PRIORIDAD: Usar datos guardados en payment, sino buscar en producto
    const productName = payment.productName || productData?.name || "Producto eliminado";
    const qty = payment.qty || 0;
    
    // Para directos, necesitamos buscar el precio en el producto o usar el monto del payment
    const productPrice = payment.productPrice || productData?.price || (payment.amount / qty) || 0;
    const netProfitPerUnit = payment.netProfitPerUnit || productData?.netProfitPerUnit || 0;
    const totalIngresos = qty * productPrice;
    const ganancia = qty * netProfitPerUnit;
    
    directOrders.push({
      id: paymentDoc.id,
      productId: payment.productId,
      productName: productName,  // ✅ Usar variable calculada
      qty: qty,
      pricePerUnit: productPrice,
      total: totalIngresos,
      ganancia: ganancia,  // ✅ Usar ganancia calculada correctamente
      closedAt: payment.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      closedAtTimestamp: payment.createdAt?.toMillis() || 0,
    });
  }

  /* ===============================
     📊 COMBINAR Y ORDENAR TODOS LOS PEDIDOS
  =============================== */
  
  const allOrders = [...closedLots, ...directOrders].sort(
    (a, b) => b.closedAtTimestamp - a.closedAtTimestamp
  );

  /* ===============================
     💰 MÉTRICAS
  =============================== */
  
  const ingresosTotales = allOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const gananciaNeta = allOrders.reduce((acc, o) => acc + (o.ganancia || 0), 0);
  const pedidosTotales = allOrders.length;

  /* ===============================
     🧾 UI
  =============================== */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Panel del fabricante
            </h1>
            <p className="text-gray-500 mt-1">
              Resumen general de tu actividad y tus ingresos
            </p>
          </div>

          {/* ✅ NUEVO: reemplaza <ActiveRoleBadge /> + <SwitchRoleButton targetRole="retailer" /> */}
          <UserRoleHeader
            userEmail={userEmail}
            activeRole="manufacturer"
          />
        </div>

        {/* KPIs */}
        <div className="grid md:grid-cols-4 gap-6 mb-14">

          {/* GANANCIA */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow p-8 border-l-4 border-green-500">
            <p className="text-sm text-gray-500 mb-1">
              Ganancia real
            </p>
            <p className="text-4xl font-bold text-green-600">
              {formatCurrency(gananciaNeta)}
            </p>
            <p className="text-xs text-green-700 mt-1">
              Beneficio neto del fabricante
            </p>
          </div>

          {/* INGRESOS */}
          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-sm text-gray-500">
              Ingresos totales
            </p>
            <p className="text-2xl font-semibold mt-2">
              {formatCurrency(ingresosTotales)}
            </p>
          </div>

          {/* PEDIDOS */}
          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-sm text-gray-500">
              Pedidos cerrados
            </p>
            <p className="text-2xl font-semibold mt-2">
              {pedidosTotales}
            </p>
          </div>
        </div>

        {/* PEDIDOS RECIENTES */}
        <div className="bg-white rounded-2xl shadow p-8 mb-14">
          <h2 className="text-xl font-semibold mb-6">
            Pedidos completados
          </h2>

          {allOrders.length === 0 ? (
            <p className="text-gray-500">
              Todavía no recibiste pedidos completados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="pb-3 text-left">Producto</th>
                    <th className="pb-3 text-left">ID producto</th>
                    <th className="pb-3 text-left">Cantidad</th>
                    <th className="pb-3 text-left">Precio/unidad</th>
                    <th className="pb-3 text-left">Fecha</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {allOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="py-4 font-medium">
                        {o.productName}
                      </td>
                      <td className="text-xs text-gray-500">
                        {o.productId}
                      </td>
                      <td>{o.qty} unidades</td>
                      <td>{formatCurrency(o.pricePerUnit)}</td>
                      <td>{o.closedAt}</td>
                      <td className="text-right font-semibold">
                        {formatCurrency(o.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ACCIONES */}
        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/dashboard/fabricante/productos/nuevo"
            className="bg-white p-8 rounded-2xl shadow hover:shadow-lg transition border border-dashed border-gray-300 hover:border-blue-500"
          >
            <h2 className="text-xl font-semibold mb-2">
              Publicar nuevo producto
            </h2>
            <p className="text-gray-600 mb-4">
              Agregá un nuevo producto para vender a revendedores
            </p>
            <span className="text-blue-600 font-medium">
              Crear producto →
            </span>
          </Link>

          <Link
            href="/dashboard/fabricante/destacados"
            className="bg-white p-8 rounded-2xl shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold mb-2">
              Productos destacados
            </h2>
            <p className="text-gray-600 mb-4">
              Aumentá la visibilidad de tus productos
            </p>
            <span className="text-blue-600 font-medium">
              Gestionar destacados →
            </span>
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function DashboardFabricante() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardFabricanteContent />
    </Suspense>
  );
}