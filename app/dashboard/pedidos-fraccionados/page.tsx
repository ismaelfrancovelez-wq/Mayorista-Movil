// app/dashboard/pedidos-fraccionados/page.tsx - CORREGIDO Y MEJORADO
import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import ActiveRoleBadge from "../../../components/ActiveRoleBadge";
import SwitchRoleButton from "../../../components/SwitchRoleButton";
import Link from "next/link";
import { formatCurrency } from "../../../lib/utils";
import { Suspense } from "react";
import { DashboardSkeleton } from "../../../components/DashboardSkeleton";

// ✅ OPTIMIZACIÓN: Caché de 10 segundos
export const dynamic = 'force-dynamic';
export const revalidate = 10;

// ✅ Definir tipo del lote
type ActiveLot = {
  id: string;
  productId: string;
  productName: string;
  type: string;
  accumulatedQty: number;
  minimumOrder: number;
  userQty: number;
  progress: number;
  userPayments: number; // Número de compras del usuario
};

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
    .limit(100)
    .get();

  const orders = ordersSnap.docs.map(doc => doc.data());

  /* ===============================
     📊 MÉTRICAS
  =============================== */

  // ✅ PEDIDOS CERRADOS (directos + fraccionados cerrados)
  const pedidosTotales = orders.filter(o =>
    o.orderType === "directa" ||
    (o.orderType === "fraccionado" && o.lotStatus === "closed")
  );

  // ⏳ PEDIDOS FRACCIONADOS EN PROCESO
  const pedidosEnProceso = orders.filter(o =>
    o.orderType === "fraccionado" && o.lotStatus !== "closed"
  );

  // 💰 TOTAL INVERTIDO (solo pedidos cerrados)
  const totalInvertido = pedidosTotales.reduce(
    (acc, o) => acc + (o.total || 0),
    0
  );

  /* ===============================
     ✅ LOTES ACTIVOS - VERSIÓN MEJORADA
     Agrupa por lote y suma las cantidades
  =============================== */
  
  // Obtener payments fraccionados activos del usuario
  const activeFractionalPayments = orders.filter(o => 
    o.orderType === "fraccionado" && 
    o.lotId && 
    o.lotStatus === "accumulating"
  );

  // Agrupar por lotId y sumar cantidades
  const lotMap = new Map<string, {
    lotId: string;
    productId: string;
    productName: string;
    totalQty: number;
    payments: number;
  }>();

  activeFractionalPayments.forEach(payment => {
    const lotId = payment.lotId;
    if (!lotId) return;

    if (lotMap.has(lotId)) {
      const existing = lotMap.get(lotId)!;
      existing.totalQty += (payment.qty || 0);
      existing.payments += 1;
    } else {
      lotMap.set(lotId, {
        lotId,
        productId: payment.productId,
        productName: payment.productName || "Producto",
        totalQty: payment.qty || 0,
        payments: 1,
      });
    }
  });

  const activeLots: ActiveLot[] = [];

  // Si hay lotes, obtenerlos
  if (lotMap.size > 0) {
    const lotIds = Array.from(lotMap.keys());
    
    for (let i = 0; i < lotIds.length; i += 10) {
      const batch = lotIds.slice(i, i + 10);
      const lotsSnap = await db
        .collection("lots")
        .where("__name__", "in", batch)
        .get();

      for (const lotDoc of lotsSnap.docs) {
        const data = lotDoc.data();
        const lotId = lotDoc.id;
        const userInfo = lotMap.get(lotId);
        
        if (!userInfo) continue;

        activeLots.push({
          id: lotId,
          productId: data.productId,
          productName: userInfo.productName,
          type: data.type,
          accumulatedQty: data.accumulatedQty || 0,
          minimumOrder: data.minimumOrder || data.MF || 0,
          userQty: userInfo.totalQty, // ✅ Suma de todas las compras del usuario
          userPayments: userInfo.payments, // ✅ Número de compras
          progress: data.minimumOrder > 0 
            ? Math.min((data.accumulatedQty / data.minimumOrder) * 100, 100)
            : 0,
        });
      }
    }

    // ✅ Solo buscar nombres de productos si faltan
    const lotsWithoutName = activeLots.filter(l => !l.productName || l.productName === "Producto");
    
    if (lotsWithoutName.length > 0) {
      const productIds = [...new Set(lotsWithoutName.map(l => l.productId))];
      
      for (let i = 0; i < productIds.length; i += 10) {
        const batch = productIds.slice(i, i + 10);
        const productsSnap = await db
          .collection("products")
          .where("__name__", "in", batch)
          .get();
        
        const productsMap = new Map();
        productsSnap.docs.forEach(doc => {
          productsMap.set(doc.id, doc.data().name);
        });

        activeLots.forEach(lot => {
          if ((!lot.productName || lot.productName === "Producto") && productsMap.has(lot.productId)) {
            lot.productName = productsMap.get(lot.productId);
          }
        });
      }
    }
  }

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

        {/* ✅ SECCIÓN PEDIDOS FRACCIONADOS EN CURSO */}
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
                        <span className="text-xs text-gray-500 ml-2">
                          (Tu pedido: {lot.userQty} unidades
                          {lot.userPayments > 1 && ` en ${lot.userPayments} compras`})
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

// ✅ Página principal con Suspense
export default function DashboardRevendedor() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardRevendedorContent />
    </Suspense>
  );
}