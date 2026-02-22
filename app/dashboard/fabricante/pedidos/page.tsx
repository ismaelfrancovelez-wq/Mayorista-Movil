import { db } from "../../../../lib/firebase-admin";
import { cookies } from "next/headers";
import BackButton from "../../../../components/BackButton";
import { formatCurrency } from "../../../../lib/utils";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Order = {
  id: string;
  type: 'lote' | 'directo';
  productName: string;
  qty: number;
  pricePerUnit: number;
  total: number;
  ganancia: number;
  date: string;
  status: string;
  buyers?: Array<{
    name: string;
    qty: number;
    address: string;
  }>;
};

export default async function PedidosFabricantePage() {
  const userId = cookies().get("userId")?.value;
  const role = cookies().get("activeRole")?.value;

  if (!userId || role !== "manufacturer") {
    return <div className="p-6">No autorizado</div>;
  }

  /* ===============================
     📦 LOTES CERRADOS
  =============================== */
  
  const lotsSnap = await db
    .collection("lots")
    .where("factoryId", "==", userId)
    .where("status", "==", "closed")
    .get();

  // ✅ FIX ERROR 16: Recolectar todos los productIds únicos de los lotes
  // para buscarlos TODOS de una sola vez con getAll() en lugar de uno por uno en un loop
  const lotProductIds = [...new Set(
    lotsSnap.docs.map(doc => doc.data().productId).filter(Boolean)
  )];

  // Buscar todos los productos de lotes en una sola operación batch
  const lotProductDocs = lotProductIds.length > 0
    ? await db.getAll(...lotProductIds.map(id => db.collection("products").doc(id)))
    : [];

  const lotProductsMap = new Map(
    lotProductDocs.filter(d => d.exists).map(d => [d.id, d.data()])
  );

  const lotOrders: Order[] = [];

  // ✅ FIX ERROR 16: Los participantes de cada lote siguen siendo una subcollección
  // pero ya no buscamos el producto individualmente en cada iteración
  for (const lotDoc of lotsSnap.docs) {
    const lotData = lotDoc.data();
    
    // Usar el mapa pre-cargado en lugar de una query individual
    const productData = lotProductsMap.get(lotData.productId) || null;
    
    const productName = lotData.productName || productData?.name || "Producto eliminado";
    const productPrice = lotData.productPrice || productData?.price || 0;
    const netProfitPerUnit = lotData.netProfitPerUnit || productData?.netProfitPerUnit || 0;
    
    // Los participantes son una subcollección — se obtienen por lote (no hay otra forma)
    const participantsSnap = await lotDoc.ref.collection("participants").get();
    const buyers = participantsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.buyerName || "Usuario",
        qty: data.qty || 0,
        address: data.buyerAddress || "N/A",
      };
    });
    
    const accumulatedQty = lotData.accumulatedQty || 0;
    
    lotOrders.push({
      id: lotDoc.id,
      type: 'lote',
      productName,
      qty: accumulatedQty,
      pricePerUnit: productPrice,
      total: accumulatedQty * productPrice,
      ganancia: accumulatedQty * netProfitPerUnit,
      date: lotData.closedAt?.toDate().toLocaleDateString("es-AR") || "-",
      status: "Completado",
      buyers,
    });
  }

  /* ===============================
     🚚 PEDIDOS DIRECTOS
  =============================== */
  
  const directOrdersSnap = await db
    .collection("payments")
    .where("factoryId", "==", userId)
    .where("orderType", "==", "directa")
    .where("status", "==", "approved")
    .get();

  // ✅ FIX ERROR 16: Recolectar todos los IDs necesarios para búsqueda batch
  const directProductIds = [...new Set(
    directOrdersSnap.docs.map(doc => doc.data().productId).filter(Boolean)
  )];
  const directBuyerIds = [...new Set(
    directOrdersSnap.docs.map(doc => doc.data().retailerId || doc.data().buyerId).filter(Boolean)
  )];

  // Buscar todos los productos, usuarios y retailers en 3 operaciones paralelas (no en loop)
  const [directProductDocs, directUserDocs, directRetailerDocs] = await Promise.all([
    directProductIds.length > 0
      ? db.getAll(...directProductIds.map(id => db.collection("products").doc(id)))
      : Promise.resolve([]),
    directBuyerIds.length > 0
      ? db.getAll(...directBuyerIds.map(id => db.collection("users").doc(id)))
      : Promise.resolve([]),
    directBuyerIds.length > 0
      ? db.getAll(...directBuyerIds.map(id => db.collection("retailers").doc(id)))
      : Promise.resolve([]),
  ]);

  // Construir mapas para búsqueda O(1)
  const directProductsMap = new Map(
    directProductDocs.filter(d => d.exists).map(d => [d.id, d.data()])
  );
  const directUsersMap = new Map(
    directUserDocs.filter(d => d.exists).map(d => [d.id, d.data()])
  );
  const directRetailersMap = new Map(
    directRetailerDocs.filter(d => d.exists).map(d => [d.id, d.data()])
  );

  const directOrders: Order[] = directOrdersSnap.docs.map(paymentDoc => {
    const payment = paymentDoc.data();
    const buyerId = payment.retailerId || payment.buyerId;

    // Usar mapas pre-cargados en lugar de queries individuales
    const productData = directProductsMap.get(payment.productId) || null;
    const buyerData = directUsersMap.get(buyerId) || null;
    const retailerData = directRetailersMap.get(buyerId) || null;

    const productName = payment.productName || productData?.name || "Producto eliminado";
    const qty = payment.qty || 0;
    const productPrice = payment.productPrice || productData?.price || (payment.amount / qty) || 0;
    const netProfitPerUnit = payment.netProfitPerUnit || productData?.netProfitPerUnit || 0;

    return {
      id: paymentDoc.id,
      type: 'directo',
      productName,
      qty,
      pricePerUnit: productPrice,
      total: qty * productPrice,
      ganancia: qty * netProfitPerUnit,
      date: payment.createdAt?.toDate().toLocaleDateString("es-AR") || "-",
      status: "Completado",
      buyers: [{
        name: buyerData?.name || buyerData?.email || "Usuario",
        qty,
        address: retailerData?.address?.formatted || "N/A",
      }],
    };
  });

  /* ===============================
     📊 COMBINAR TODOS
  =============================== */
  
  const allOrders = [...lotOrders, ...directOrders];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        
        <h1 className="text-3xl font-bold mb-2">
          Pedidos de tus productos
        </h1>
        <p className="text-gray-600 mb-8">
          Historial completo de lotes cerrados y pedidos directos
        </p>

        {allOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">
              No tenés pedidos completados todavía.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {allOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{order.productName}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.type === 'lote' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {order.type === 'lote' ? 'Lote Fraccionado' : 'Pedido Directo'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{order.date}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {order.status}
                  </span>
                </div>

                {/* Resumen */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cantidad total</p>
                    <p className="font-semibold">{order.qty} unidades</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Precio/unidad</p>
                    <p className="font-semibold">{formatCurrency(order.pricePerUnit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total ingresos</p>
                    <p className="font-semibold">{formatCurrency(order.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ganancia neta</p>
                    <p className="font-semibold text-green-600">{formatCurrency(order.ganancia)}</p>
                  </div>
                </div>

                {/* Compradores */}
                {order.buyers && order.buyers.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-3">
                      {order.type === 'lote' 
                        ? `Distribución por revendedor (${order.buyers.length})` 
                        : 'Cliente'}
                    </h4>
                    <div className="space-y-2">
                      {order.buyers.map((buyer, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{buyer.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{buyer.address}</p>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                              {buyer.qty} unidades
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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