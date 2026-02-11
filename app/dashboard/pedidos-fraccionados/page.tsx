// app/dashboard/pedidos-fraccionados/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase-client";
import ActiveRoleBadge from "../../../components/ActiveRoleBadge";
import SwitchRoleButton from "../../../components/SwitchRoleButton";
import Link from "next/link";

type ActiveLot = {
  id: string;
  productId: string;
  productName: string;
  factoryName: string;
  type: string;
  accumulatedQty: number;
  minimumOrder: number;
  userQty: number;
  progress: number;
  remaining: number;
};

export default function DashboardRevendedor() {
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pedidosTotales, setPedidosTotales] = useState(0);
  const [pedidosEnProceso, setPedidosEnProceso] = useState(0);
  const [totalInvertido, setTotalInvertido] = useState(0);
  const [activeLots, setActiveLots] = useState<ActiveLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // ✅ Obtener userId desde /api/auth/me (como lo hace tu web)
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        
        if (!res.ok) {
          setAuthLoading(false);
          return;
        }

        const data = await res.json();
        setUserId(data.userId);
        setRole(data.role);
        setAuthLoading(false);
      } catch (error) {
        console.error("Error verificando autenticación:", error);
        setAuthLoading(false);
      }
    }

    checkAuth();
  }, []);

  useEffect(() => {
    if (!userId || authLoading) return;

    setLoading(true);

    // ✅ SUSCRIPCIÓN EN TIEMPO REAL a los pagos
    const paymentsQuery = query(
      collection(db, "payments"),
      where("retailerId", "==", userId)
    );

    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => doc.data());

      // ✅ PEDIDOS CERRADOS (directos + fraccionados cerrados)
      const totales = orders.filter(o =>
        o.orderType === "directa" ||
        (o.orderType === "fraccionado" && o.lotStatus === "closed")
      );

      // ⏳ PEDIDOS FRACCIONADOS EN PROCESO
      const enProceso = orders.filter(o =>
        o.orderType === "fraccionado" && o.lotStatus !== "closed"
      );

      // 💰 TOTAL INVERTIDO (solo pedidos cerrados)
      const invertido = totales.reduce(
        (acc, o) => acc + (o.total || 0),
        0
      );

      setPedidosTotales(totales.length);
      setPedidosEnProceso(enProceso.length);
      setTotalInvertido(invertido);
    });

    // ✅ SUSCRIPCIÓN EN TIEMPO REAL a los lotes activos
    const lotsQuery = query(
      collection(db, "lots"),
      where("status", "==", "accumulating")
    );

    const unsubscribeLots = onSnapshot(lotsQuery, async (snapshot) => {
      const lotsData: ActiveLot[] = [];

      for (const lotDoc of snapshot.docs) {
        const lotData = lotDoc.data();

        // ✅ Obtener participantes usando getDocs en la subcolección
        const participantsRef = collection(db, "lots", lotDoc.id, "participants");
        const participantsSnap = await getDocs(participantsRef);
        const participants = participantsSnap.docs.map((d: any) => d.data());

        // Verificar si este usuario tiene pedidos en este lote
        const userParticipant = participants.find((p: any) => p.buyerId === userId);

        if (!userParticipant) continue;

        // Obtener información del producto
        const productRef = doc(db, "products", lotData.productId);
        const productSnap = await getDoc(productRef);
        const product = productSnap.data();

        // Obtener información del fabricante
        const factoryRef = doc(db, "manufacturers", lotData.factoryId);
        const factorySnap = await getDoc(factoryRef);
        const factory = factorySnap.data();

        const accumulatedQty = lotData.accumulatedQty || 0;
        const minimumOrder = lotData.minimumQty || lotData.minimumOrder || product?.minimumOrder || 0;
        const progress = minimumOrder > 0 
          ? Math.min((accumulatedQty / minimumOrder) * 100, 100)
          : 0;
        const remaining = Math.max(0, minimumOrder - accumulatedQty);

        lotsData.push({
          id: lotDoc.id,
          productId: lotData.productId,
          productName: product?.name || lotData.productName || "Producto",
          factoryName: factory?.businessName || factory?.name || "Fabricante",
          type: lotData.type,
          accumulatedQty,
          minimumOrder,
          userQty: userParticipant.qty || 0,
          progress,
          remaining,
        });
      }

      setActiveLots(lotsData);
      setLoading(false);
    });

    return () => {
      unsubscribePayments();
      unsubscribeLots();
    };
  }, [userId, authLoading]);

  // Mostrar loading mientras verifica la autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Mostrar error si no está autenticado
  if (!userId || role !== "retailer") {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">No autorizado</h1>
          <p className="text-red-600">
            Debes iniciar sesión como revendedor para acceder a esta página
          </p>
          <a
            href="/login"
            className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

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
              Gestioná tus compras y pedidos (actualizado en tiempo real)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <ActiveRoleBadge />
            <SwitchRoleButton targetRole="manufacturer" />
          </div>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid md:grid-cols-3 gap-6 mb-12 animate-pulse">
            <div className="bg-gray-200 h-24 rounded-xl"></div>
            <div className="bg-gray-200 h-24 rounded-xl"></div>
            <div className="bg-gray-200 h-24 rounded-xl"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 mb-12">

            {/* ✅ PEDIDOS TOTALES */}
            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-sm text-gray-500">Pedidos totales</p>
              <p className="text-3xl font-semibold mt-2">
                {pedidosTotales}
              </p>
            </div>

            {/* ⏳ PEDIDOS EN PROCESO */}
            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-sm text-gray-500">Pedidos en proceso</p>
              <p className="text-3xl font-semibold mt-2">
                {pedidosEnProceso}
              </p>
            </div>

            {/* 💰 TOTAL INVERTIDO */}
            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-sm text-gray-500">Total invertido</p>
              <p className="text-3xl font-semibold mt-2">
                $ {totalInvertido.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

          </div>
        )}

        {/* ✅ SECCIÓN PEDIDOS FRACCIONADOS EN CURSO (TIEMPO REAL) */}
        <div className="bg-white rounded-xl shadow p-6 mb-12">
          <h2 className="text-lg font-semibold mb-4">
            Pedidos fraccionados en curso
          </h2>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-16 bg-gray-200 rounded"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          ) : activeLots.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No tenés pedidos fraccionados en proceso actualmente.
            </p>
          ) : (
            <div className="space-y-6">
              {activeLots.map((lot) => {
                const progressPercent = Math.round(lot.progress);
                const isNearComplete = progressPercent >= 80;
                
                return (
                  <div key={lot.id} className="border border-gray-200 rounded-lg p-4">
                    {/* Encabezado */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {lot.productName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Fabricante: {lot.factoryName}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        En progreso
                      </span>
                    </div>

                    {/* Tu pedido */}
                    <div className="bg-purple-50 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium text-purple-900">
                        Tu pedido: <span className="text-lg">{lot.userQty}</span> unidades
                      </p>
                    </div>

                    {/* Progreso del lote */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Progreso del lote</span>
                        <span className="text-gray-600">
                          {lot.accumulatedQty} / {lot.minimumOrder} unidades
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                        <div
                          className={`h-4 rounded-full transition-all ${
                            isNearComplete ? 'bg-green-600' : 'bg-purple-600'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{progressPercent}% completado</span>
                        <span>Faltan {lot.remaining} unidades</span>
                      </div>

                      {isNearComplete && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <span>🎉</span>
                          <span>¡Cerca de completarse!</span>
                        </p>
                      )}
                    </div>
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