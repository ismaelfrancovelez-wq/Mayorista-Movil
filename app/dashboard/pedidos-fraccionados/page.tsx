import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import ActiveRoleBadge from "../../../components/ActiveRoleBadge";
import SwitchRoleButton from "../../../components/SwitchRoleButton";
import Link from "next/link";
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react"; // ✅ NUEVO
import { DashboardSkeleton } from "../../../components/DashboardSkeleton"; // ✅ NUEVO

// ✅ NUEVO: Separar contenido en función async
async function DashboardRevendedorContent() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "retailer") {
    return <div className="p-6">No autorizado</div>;
  }

  /* ===============================
     🧾 PEDIDOS DEL REVENDEDOR
  =============================== */
  const ordersSnap = await db
    .collection("payments")
    .where("buyerId", "==", userId)
    .get();

  const orders = ordersSnap.docs.map(doc => doc.data());

  /* ===============================
     📊 MÉTRICAS
  =============================== */

  // ✅ PEDIDOS CERRADOS (directos + fraccionados cerrados)
  const pedidosTotales = orders.filter(o =>
    o.type === "direct" ||
    (o.type === "fractional" && o.lotStatus === "closed")
  );

  // ⏳ PEDIDOS FRACCIONADOS EN PROCESO
  const pedidosEnProceso = orders.filter(o =>
    o.type === "fractional" && o.lotStatus !== "closed"
  );

  // 💰 TOTAL INVERTIDO (solo pedidos cerrados)
  const totalInvertido = pedidosTotales.reduce(
    (acc, o) => acc + (o.total || 0),
    0
  );

  /* ===============================
     ✅ FIX ERROR 22: LOTES ACTIVOS REALES
     Traer datos reales de Firestore
  =============================== */
  const activeLotsSnap = await db
    .collection("lots")
    .where("status", "==", "accumulating")
    .get();

  // Filtrar solo los lotes donde este usuario tiene pedidos
  const activeLots = activeLotsSnap.docs
    .map(doc => {
      const data = doc.data();
      const orders = data.orders || [];
      
      // Verificar si este usuario tiene pedidos en este lote
      const userOrders = orders.filter(
        (o: any) => o.retailerId === userId
      );
      
      if (userOrders.length === 0) return null;
      
      // Calcular cantidad del usuario en este lote
      const userQty = userOrders.reduce(
        (sum: number, o: any) => sum + (o.qty || 0),
        0
      );
      
      return {
        id: doc.id,
        productId: data.productId,
        productName: data.productName || "Producto",
        type: data.type,
        accumulatedQty: data.accumulatedQty || 0,
        minimumOrder: data.minimumOrder || data.MF || 0,
        userQty,
        progress: data.minimumOrder > 0 
          ? Math.min((data.accumulatedQty / data.minimumOrder) * 100, 100)
          : 0,
      };
    })
    .filter(Boolean); // Remover nulls

  // Obtener nombres de productos para los lotes
  const productIds = [...new Set(activeLots.map(l => l?.productId).filter(Boolean))];
  const productsSnap = await db
    .collection("products")
    .where("__name__", "in", productIds.length > 0 ? productIds : ["dummy"])
    .get();
  
  const productsMap = new Map();
  productsSnap.docs.forEach(doc => {
    productsMap.set(doc.id, doc.data().name);
  });

  // Actualizar nombres de productos
  activeLots.forEach(lot => {
    if (lot && lot.productId && productsMap.has(lot.productId)) {
      lot.productName = productsMap.get(lot.productId);
    }
  });

  /* ===============================
     🧾 UI
  =============================== */
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

          {/* ✅ PEDIDOS TOTALES */}
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Pedidos totales</p>
            <p className="text-3xl font-semibold mt-2">
              {pedidosTotales.length}
            </p>
          </div>

          {/* ⏳ PEDIDOS EN PROCESO */}
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Pedidos en proceso</p>
            <p className="text-3xl font-semibold mt-2">
              {pedidosEnProceso.length}
            </p>
          </div>

          {/* 💰 TOTAL INVERTIDO */}
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-sm text-gray-500">Total invertido</p>
            <p className="text-3xl font-semibold mt-2">
              {formatCurrency(totalInvertido)}
            </p>
          </div>

        </div>

        {/* ✅ FIX ERROR 22: SECCIÓN PEDIDOS FRACCIONADOS EN CURSO (DATOS REALES) */}
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
                if (!lot) return null;
                
                const progressPercent = Math.round(lot.progress);
                const isNearComplete = progressPercent >= 80;
                
                return (
                  <div key={lot.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <div>
                        <span className="font-medium">{lot.productName}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          (Tu pedido: {lot.userQty} unidades)
                        </span>
                      </div>
                      <span className="text-gray-500">
                        {lot.accumulatedQty} / {lot.minimumOrder}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          isNearComplete ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    
                    {isNearComplete && (
                      <p className="text-xs text-green-600 mt-1">
                        ¡Cerca de completarse!
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* EXPLORAR PRODUCTOS (SE MANTIENE) */}
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

// ✅ NUEVO: Página principal con Suspense
export default function DashboardRevendedor() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardRevendedorContent />
    </Suspense>
  );
}