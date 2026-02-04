import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import Link from "next/link";
import ActiveRoleBadge from "../../../components/ActiveRoleBadge";
import SwitchRoleButton from "../../../components/SwitchRoleButton";
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react"; // ✅ NUEVO
import { DashboardSkeleton } from "../../../components/DashboardSkeleton"; // ✅ NUEVO

// ✅ NUEVO: Separar contenido en función async
async function DashboardFabricanteContent() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "manufacturer") {
    return <div className="p-6">No autorizado</div>;
  }

  /* ===============================
     💳 PEDIDOS CERRADOS
  =============================== */
  const ordersSnap = await db
    .collection("payments")
    .where("factoryId", "==", userId)
    .where("lotStatus", "==", "closed")
    .orderBy("createdAt", "desc")
    .get();

  const orders = ordersSnap.docs.map((doc) => {
    const o = doc.data();

    const qty = o.qty || 0;
    const netProfitPerUnit = o.netProfitPerUnit || 0;

    return {
      id: doc.id,
      productId: o.productId || "-",
      productName: o.productName || "Producto",
      qty,
      netProfitPerUnit,
      netProfit: qty * netProfitPerUnit, // 👈 GANANCIA REAL
      total:
        (o.totalProductPrice || 0) +
        (o.shippingIncome || 0),
      createdAt: o.createdAt
        ? o.createdAt.toDate().toLocaleDateString("es-AR")
        : "-",
    };
  });

  /* ===============================
     📊 MÉTRICAS
  =============================== */
  // ✅ Ingresos totales (producto + envío que recibe el fabricante)
  const ingresosTotales = orders.reduce(
    (acc, o) => acc + (o.total || 0),
    0
  );

  // ✅ Ganancia neta REAL del fabricante (SOLO informativo)
  const gananciaNeta = orders.reduce(
    (acc, o) => acc + (o.netProfit || 0),
    0
  );

  const pedidosTotales = orders.length;

  /* ===============================
     🧾 UI - ✅ FIX ERROR 21: formatCurrency
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

          <div className="flex items-center gap-4">
            <ActiveRoleBadge />
            <SwitchRoleButton targetRole="retailer" />
          </div>
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
            Pedidos recientes
          </h2>

          {orders.length === 0 ? (
            <p className="text-gray-500">
              Todavía no recibiste pedidos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="pb-3 text-left">Producto</th>
                    <th className="pb-3 text-left">ID producto</th>
                    <th className="pb-3 text-left">Cantidad</th>
                    <th className="pb-3 text-left">Fecha</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
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
                      <td>{o.qty}</td>
                      <td>{o.createdAt}</td>
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

// ✅ NUEVO: Página principal con Suspense
export default function DashboardFabricante() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardFabricanteContent />
    </Suspense>
  );
}