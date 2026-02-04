// app/dashboard/pedidos-fraccionados/pedidos/page.tsx

import { db } from "../../../../lib/firebase-admin";
import { cookies } from "next/headers";

type Pedido = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  orderType: "direct" | "fractional";
  lotType?: "fractional_shipping" | "fractional_pickup";
  status: "accumulating" | "closed" | "completed";
  paymentId: string;
  paymentStatus: string;
  amount: number;
  shippingCost: number; // ✅ Siempre será un número (0 si no hay costo)
  total: number;
  createdAt: string;
  createdAtTimestamp: number;
};

async function getRetailerOrders(retailerId: string): Promise<Pedido[]> {
  // ✅ CORRECTO: Usar "retailerId" (como se guarda en el webhook)
  const paymentsSnap = await db
    .collection("payments")
    .where("retailerId", "==", retailerId)
    .get();

  if (paymentsSnap.empty) {
    return [];
  }

  const orders: Pedido[] = [];

  for (const paymentDoc of paymentsSnap.docs) {
    const payment = paymentDoc.data();

    // Obtener información del producto
    const productSnap = await db
      .collection("products")
      .doc(payment.productId)
      .get();

    const product = productSnap.data();

    // Determinar el estado del pedido
    let status: "accumulating" | "closed" | "completed" = "completed";
    
    // Para pedidos fraccionados, verificar el estado del lote
    if (payment.orderType === "fractional" && payment.lotType) {
      const lotSnap = await db
        .collection("lots")
        .where("productId", "==", payment.productId)
        .where("type", "==", payment.lotType)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      status = lotSnap.empty ? "accumulating" : lotSnap.docs[0].data().status;
    }

    // ✅ Usar splitPayment si existe, sino calcular manual
    const splitPayment = payment.splitPayment || {};
    const amount = splitPayment.productTotal || payment.amount || 0;
    const shippingCost = splitPayment.shippingCost || payment.shippingCost || 0; // ✅ Siempre 0 mínimo
    const total = splitPayment.total || amount + shippingCost;

    orders.push({
      id: paymentDoc.id,
      productId: payment.productId,
      productName: product?.name || "Producto desconocido",
      qty: payment.qty,
      orderType: payment.orderType || "direct",
      lotType: payment.lotType,
      status,
      paymentId: payment.preferenceId || paymentDoc.id,
      paymentStatus: payment.status,
      amount,
      shippingCost, // ✅ Garantizado número
      total,
      createdAt: payment.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      createdAtTimestamp: payment.createdAt?.toMillis() || 0,
    });
  }

  // Ordenar por fecha (más recientes primero)
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

  const retailerSnap = await db
    .collection("retailers")
    .doc(userId)
    .get();

  if (!retailerSnap.exists) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p className="text-red-600">
            No se encontró el perfil de revendedor. Por favor, contacta a soporte.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            User ID: {userId}
          </p>
        </div>
      </div>
    );
  }

  const retailerId = userId;
  const orders = await getRetailerOrders(retailerId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Mis Pedidos
          </h1>
          <p className="text-gray-600">
            Historial completo de tus compras
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
            {orders.map((order) => (
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
                          order.orderType === "direct"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {order.orderType === "direct" ? "Compra directa" : "Compra fraccionada"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{order.createdAt}</p>
                  </div>
                  
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === "completed" || order.status === "closed"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {order.status === "completed" || order.status === "closed"
                      ? "Completado"
                      : "En proceso"}
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
                      {order.orderType === "direct"
                        ? "Directa"
                        : order.lotType === "fractional_shipping"
                        ? "Fraccionado con envío"
                        : "Fraccionado retiro"}
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
                        className={`font-semibold ${
                          order.paymentStatus === "approved"
                            ? "text-green-600"
                            : order.paymentStatus === "pending"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {order.paymentStatus === "approved"
                          ? "Pagado"
                          : order.paymentStatus === "pending"
                          ? "Pendiente"
                          : "Rechazado"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mensajes informativos */}
                {order.orderType === "fractional" && order.status === "accumulating" && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      ⏳ Este pedido fraccionado está acumulándose con otros compradores hasta alcanzar el mínimo de compra
                    </p>
                  </div>
                )}

                {order.orderType === "fractional" && order.status === "closed" && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      ✅ El lote se ha cerrado y tu pedido está siendo preparado para envío
                    </p>
                  </div>
                )}

                {order.orderType === "direct" && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      📦 Compra directa completada - El fabricante procesará tu pedido
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}