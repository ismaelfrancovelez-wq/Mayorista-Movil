// app/dashboard/pedidos-fraccionados/pedidos/page.tsx
import { db } from "../../../../lib/firebase-admin";
import { cookies } from "next/headers";
import { formatCurrency } from "../../../../lib/utils";

export const dynamic = 'force-dynamic';
export const revalidate = 10; // ✅ 10 segundos (actualización rápida)

type Pedido = {
  id: string;
  productId: string;
  productName: string;
  factoryName: string;
  qty: number;
  orderType: "directa" | "fraccionado";
  lotType?: string;
  status: "accumulating" | "closed" | "completed";
  amount: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  createdAtTimestamp: number;
  lotProgress?: {
    currentQty: number;
    targetQty: number;
    percentage: number;
    remaining: number;
  };
};

async function getRetailerOrders(retailerId: string): Promise<Pedido[]> {
  // ✅ Query sin orderBy (se ordena en JavaScript después)
  const paymentsSnap = await db
    .collection("payments")
    .where("retailerId", "==", retailerId)
    .limit(50)
    .get();

  if (paymentsSnap.empty) {
    return [];
  }

  const orders: Pedido[] = [];

  // ✅ OPTIMIZACIÓN: Solo consultar lotes únicos (si hay pedidos fraccionados)
  const lotIds = new Set<string>();

  paymentsSnap.docs.forEach(doc => {
    const payment = doc.data();
    if (payment.lotId) lotIds.add(payment.lotId);
  });

  // ✅ OPTIMIZACIÓN: Batch query para lotes (solo los campos necesarios)
  const lotsMap = new Map();
  if (lotIds.size > 0) {
    const lotIdsArray = Array.from(lotIds);
    for (let i = 0; i < lotIdsArray.length; i += 10) {
      const batch = lotIdsArray.slice(i, i + 10);
      const lotsSnap = await db
        .collection("lots")
        .where("__name__", "in", batch)
        .get();
      lotsSnap.docs.forEach(doc => {
        const data = doc.data();
        lotsMap.set(doc.id, {
          status: data.status,
          accumulatedQty: data.accumulatedQty,
          minimumOrder: data.minimumOrder || data.minimumQty,
        });
      });
    }
  }

  // ✅ Procesar todos los pagos usando datos guardados (sin consultas extra)
  for (const paymentDoc of paymentsSnap.docs) {
    const payment = paymentDoc.data();

    // ✅ OPTIMIZACIÓN: Usar datos guardados directamente (sin consultas extra)
    const productName = payment.productName || "Producto";
    const factoryName = payment.factoryName || "Fabricante";
    const productPrice = payment.productPrice || 0;

    let status: "accumulating" | "closed" | "completed" = "completed";
    let lotProgress: Pedido["lotProgress"] | undefined;

    if (payment.orderType === "fraccionado" && payment.lotId) {
      const lotData = lotsMap.get(payment.lotId);
      
      if (lotData) {
        status = lotData.status || "accumulating";
        
        const currentQty = lotData.accumulatedQty || 0;
        const targetQty = lotData.minimumOrder || 0;
        
        if (targetQty > 0) {
          lotProgress = {
            currentQty,
            targetQty,
            percentage: Math.min((currentQty / targetQty) * 100, 100),
            remaining: Math.max(targetQty - currentQty, 0),
          };
        }
      } else {
        status = "accumulating";
      }
    }

    orders.push({
      id: paymentDoc.id,
      productId: payment.productId,
      productName,
      factoryName,
      qty: payment.qty || 0,
      orderType: payment.orderType || "directa",
      lotType: payment.lotType,
      status,
      amount: payment.amount || 0,
      shippingCost: payment.shippingCost || 0,
      total: payment.total || 0,
      createdAt: payment.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      createdAtTimestamp: payment.createdAt?.toMillis() || 0,
      lotProgress,
    });
  }

  // ✅ Ordenar en JavaScript (sin índice de Firestore)
  orders.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);

  return orders;
}

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

                    {order.shippingCost > 0 && (
                      <div>
                        <p className="text-gray-500">Envío</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(order.shippingCost)}
                        </p>
                      </div>
                    )}
                  </div>

                  {isFraccionado && isEnProceso && order.lotProgress && (
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

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">Total pagado</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(order.total)}
                        </p>
                      </div>
                    </div>
                    
                    {isFraccionado && isEnProceso && (
                      <p className="text-xs text-purple-600 mt-3 flex items-center gap-1">
                        <span>⏳</span>
                        <span>Esperando a que el lote se complete</span>
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