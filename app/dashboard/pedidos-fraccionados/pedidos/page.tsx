// app/dashboard/pedidos-fraccionados/pedidos/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase-client";

type Pedido = {
  id: string;
  productId: string;
  productName: string;
  factoryId: string;
  factoryName: string;
  qty: number;
  orderType: "directa" | "fraccionado";
  lotType?: string;
  status: "accumulating" | "closed" | "completed";
  paymentId: string;
  paymentStatus: string;
  amount: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  createdAtTimestamp: number;
  // Datos del lote (solo para fraccionados)
  lotId?: string;
  accumulatedQty?: number;
  minimumQty?: number;
  progress?: number;
  remaining?: number;
};

export default function PedidosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener userId de las cookies
    const userIdCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("userId="))
      ?.split("=")[1];

    if (userIdCookie) {
      setUserId(userIdCookie);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    // ✅ SUSCRIPCIÓN EN TIEMPO REAL a los pagos del usuario
    const paymentsQuery = query(
      collection(db, "payments"),
      where("retailerId", "==", userId)
    );

    const unsubscribe = onSnapshot(paymentsQuery, async (snapshot) => {
      const ordersData: Pedido[] = [];

      for (const paymentDoc of snapshot.docs) {
        const payment = paymentDoc.data();

        // Obtener información del producto
        const productRef = doc(db, "products", payment.productId);
        const productSnap = await getDoc(productRef);
        const product = productSnap.data();

        // Obtener información del fabricante
        const factoryRef = doc(db, "manufacturers", payment.factoryId);
        const factorySnap = await getDoc(factoryRef);
        const factory = factorySnap.data();

        let status: "accumulating" | "closed" | "completed" = "completed";
        let accumulatedQty: number | undefined;
        let minimumQty: number | undefined;
        let progress: number | undefined;
        let remaining: number | undefined;
        let lotId: string | undefined;

        // Para pedidos fraccionados, obtener datos del lote EN TIEMPO REAL
        if (payment.orderType === "fraccionado" && payment.lotId) {
          lotId = payment.lotId;
          const lotRef = doc(db, "lots", payment.lotId);
          const lotSnap = await getDoc(lotRef);

          if (lotSnap.exists()) {
            const lotData = lotSnap.data();
            status = lotData.status || "accumulating";
            accumulatedQty = lotData.accumulatedQty || 0;
            minimumQty = lotData.minimumQty || lotData.minimumOrder || product?.minimumOrder || 0;
            
            // ✅ FIX: Solo calcular si minimumQty existe
            if (minimumQty && minimumQty > 0 && accumulatedQty !== undefined) {
              progress = Math.round((accumulatedQty / minimumQty) * 100);
              remaining = Math.max(0, minimumQty - accumulatedQty);
            }
          }
        }

        ordersData.push({
          id: paymentDoc.id,
          productId: payment.productId,
          productName: product?.name || "Producto desconocido",
          factoryId: payment.factoryId,
          factoryName: factory?.businessName || factory?.name || "Fabricante",
          qty: payment.qty || 0,
          orderType: payment.orderType || "directa",
          lotType: payment.lotType,
          status,
          paymentId: payment.paymentId || paymentDoc.id,
          paymentStatus: payment.status,
          amount: payment.amount || 0,
          shippingCost: payment.shippingCost || 0,
          total: payment.total || 0,
          createdAt: payment.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
          createdAtTimestamp: payment.createdAt?.toMillis() || 0,
          lotId,
          accumulatedQty,
          minimumQty,
          progress,
          remaining,
        });
      }

      // Ordenar por fecha (más recientes primero)
      ordersData.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);

      setOrders(ordersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">No autorizado</h1>
          <p className="text-red-600">
            Debes iniciar sesión para acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Mis Pedidos
          </h1>
          <p className="text-gray-600">
            Historial completo de tus compras (actualizado en tiempo real)
          </p>
        </div>

        {/* Lista de pedidos */}
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
              const isEnProceso = isFraccionado && order.status === "accumulating";
              
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
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isFraccionado
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isFraccionado ? "Compra fraccionada" : "Compra directa"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">{order.createdAt}</p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Fabricante:</span> {order.factoryName}
                      </p>
                    </div>
                    
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isEnProceso
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {isEnProceso ? "En progreso" : "Completado"}
                    </span>
                  </div>

                  {/* Información del pedido */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Cantidad</p>
                      <p className="font-semibold text-gray-900">{order.qty} unidades</p>
                    </div>

                    <div>
                      <p className="text-gray-500">Modalidad</p>
                      <p className="font-semibold text-gray-900">
                        {isFraccionado
                          ? order.lotType === "fractional_shipping"
                            ? "Fraccionado con envío"
                            : "Fraccionado retiro"
                          : "Directa"}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500">Producto</p>
                      <p className="font-semibold text-gray-900">
                        ${order.amount.toFixed(2)}
                      </p>
                    </div>

                    {order.shippingCost > 0 && (
                      <div>
                        <p className="text-gray-500">Envío</p>
                        <p className="font-semibold text-gray-900">
                          ${order.shippingCost.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Progreso del lote (solo para fraccionados en progreso) */}
                  {isFraccionado && isEnProceso && order.progress !== undefined && order.accumulatedQty !== undefined && order.minimumQty !== undefined && (
                    <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-purple-900">Progreso del lote</span>
                        <span className="text-purple-700">
                          {order.accumulatedQty} / {order.minimumQty} unidades
                        </span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min(order.progress, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-purple-700">
                        <span>{order.progress}% completado</span>
                        {order.remaining !== undefined && (
                          <span>Faltan {order.remaining} unidades</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">Total pagado</p>
                        <p className="text-lg font-bold text-gray-900">
                          ${order.total.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Estado del pago</p>
                        <p
                          className={`text-sm font-medium ${
                            order.paymentStatus === "approved"
                              ? "text-green-600"
                              : "text-yellow-600"
                          }`}
                        >
                          {order.paymentStatus === "approved" ? "Pagado" : "Pendiente"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Mensaje de estado */}
                    {isFraccionado && isEnProceso && (
                      <p className="text-xs text-purple-600 mt-3 flex items-center gap-1">
                        <span>⏳</span>
                        <span>Esperando a que el lote se complete para procesar tu pedido</span>
                      </p>
                    )}
                    {isFraccionado && !isEnProceso && (
                      <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                        <span>✅</span>
                        <span>Lote completado - El fabricante procesará tu pedido</span>
                      </p>
                    )}
                    {!isFraccionado && (
                      <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
                        <span>📦</span>
                        <span>Compra directa completada - El fabricante procesará tu pedido</span>
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