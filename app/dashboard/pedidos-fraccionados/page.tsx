import { db } from "../../../lib/firebase-admin";
import { cookies } from "next/headers";
import PedidoFraccionadoCard from "../../../components/PedidoFraccionadoCard";

/* =====================================================
   🔐 OBTENER ID DEL REVENDEDOR
   ✔ NO rompe SSR
   ✔ Middleware ya protege la ruta
===================================================== */
async function getRetailerId() {
  const cookieStore = cookies();
  return cookieStore.get("retailerId")?.value || null;
}

/* =====================================================
   📦 PAGE
===================================================== */
export default async function PedidosFraccionadosPage() {
  const retailerId = await getRetailerId();

  // ⚠️ Seguridad extra (middleware ya redirige)
  if (!retailerId) {
    return (
      <div className="p-6">
        <p>No autorizado</p>
      </div>
    );
  }

  /* ===============================
     1️⃣ PAGOS FRACCIONADOS
  =============================== */
  const paymentsSnap = await db
    .collection("payments")
    .where("retailerId", "==", retailerId)
    .where("isFraccionado", "==", true)
    .orderBy("createdAt", "desc")
    .get();

  if (paymentsSnap.empty) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">
          Pedidos fraccionados
        </h1>
        <p>No tenés pedidos fraccionados todavía.</p>
      </div>
    );
  }

  /* ===============================
     2️⃣ MAPEAR PAGOS + LOTE
  =============================== */
  const cards = await Promise.all(
    paymentsSnap.docs.map(async (doc) => {
      const payment = doc.data();

      // 🔎 Buscar lote activo o cerrado
      const lotSnap = await db
        .collection("lots")
        .where("productId", "==", payment.productId)
        .where("factoryId", "==", payment.factoryId)
        .where("type", "==", payment.lotType)
        .limit(1)
        .get();

      const lot = lotSnap.empty ? null : lotSnap.docs[0].data();

      // 🏷 Obtener producto
      const productSnap = await db
        .collection("products")
        .doc(payment.productId)
        .get();

      const productName =
        productSnap.data()?.name || "Producto";

      return {
        paymentId: doc.id,
        productName,
        qty: payment.qty,
        MF: payment.MF,
        accumulatedQty: lot?.accumulatedQty || payment.qty,
        status: lot?.status || "accumulating",
        createdAt: payment.createdAt
          ?.toDate()
          .toLocaleDateString("es-AR"),
        refundable: payment.refundable === true,
      };
    })
  );

  /* ===============================
     3️⃣ RENDER
  =============================== */
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">
        Pedidos fraccionados
      </h1>

      <div className="space-y-4">
        {cards.map((card) => (
          <PedidoFraccionadoCard
            key={card.paymentId}
            {...card}
          />
        ))}
      </div>
    </div>
  );
}