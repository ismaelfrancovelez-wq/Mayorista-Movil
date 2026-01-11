import { db } from "../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { FraccionatedLot } from "../lib/lots";

/* =====================================================
   1️⃣ ORDEN LOGÍSTICA FINAL (NO TOCAR)
   Se crea UNA sola vez cuando un lote fraccionado se cierra
===================================================== */

export async function createOrderFromClosedLot(
  lot: FraccionatedLot & { id: string }
) {
  // 🛑 Seguridad absoluta
  if (lot.status !== "closed") return;
  if (lot.orderCreated === true) return;

  // 🔒 Evitar duplicados (misma fábrica + producto)
  const existing = await db
    .collection("orders")
    .where("origin", "==", "fraccionado")
    .where("productId", "==", lot.productId)
    .where("factoryId", "==", lot.factoryId)
    .limit(1)
    .get();

  if (!existing.empty) return;

  // 🏭 Obtener fábrica
  const factorySnap = await db
    .collection("manufacturers")
    .doc(lot.factoryId)
    .get();

  const factory = factorySnap.data();
  if (!factory || !factory.address) {
    throw new Error("La fábrica no tiene dirección cargada");
  }

  // 🏪 Obtener revendedores
  const items = await Promise.all(
    lot.orders.map(async (o) => {
      const retailerSnap = await db
        .collection("resellers")
        .doc(o.retailerId)
        .get();

      const retailer = retailerSnap.data();
      if (!retailer || !retailer.address) {
        throw new Error(
          `El revendedor ${o.retailerId} no tiene dirección cargada`
        );
      }

      return {
        retailerId: o.retailerId,
        qty: o.qty,
        name:
          retailer.businessName ||
          retailer.contactFullName ||
          "Revendedor",
        address: retailer.address,
      };
    })
  );

  // 📦 Crear ORDEN FINAL (logística)
  await db.collection("orders").add({
    origin: "fraccionado",
    productId: lot.productId,
    factoryId: lot.factoryId,
    factoryAddress: factory.address,
    totalQty: lot.accumulatedQty,
    items,
    status: "ready_to_ship",
    createdAt: FieldValue.serverTimestamp(),
  });

  // 🔒 Marcar lote como procesado (USAR ID REAL)
  await db
    .collection("lots")
    .doc(lot.id)
    .update({
      orderCreated: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

  /* =====================================================
     🔓 LIBERAR PAGOS AL CERRAR LOTE (FIX FINAL)
     - Libera dinero a fábrica
     - Bloquea reembolsos
     - Pagos fraccionados retenidos hasta cierre
  ===================================================== */

  await db.runTransaction(async (tx) => {
    const paymentsSnap = await tx.get(
      db
        .collection("payments")
        .where("productId", "==", lot.productId)
        .where("factoryId", "==", lot.factoryId)
        .where("lotType", "==", lot.type)
        .where("settled", "==", false)
        .where("refunded", "!=", true)
    );

    paymentsSnap.docs.forEach((doc) => {
      tx.update(doc.ref, {
        settled: true,                 // 💰 dinero liberado
        refundable: false,             // 🚫 no más reembolsos
        settledAt: FieldValue.serverTimestamp(),
      });
    });
  });
}

/* =====================================================
   2️⃣ ORDEN DE COMPRA DEL USUARIO
   (flujo futuro / dashboard)
===================================================== */

type CreatePurchaseOrderInput = {
  productId: string;
  qty: number;
  tipo: "directa" | "fraccionada";
  withShipping: boolean;
  preferenceId: string;
};

export async function createPurchaseOrder({
  productId,
  qty,
  tipo,
  withShipping,
  preferenceId,
}: CreatePurchaseOrderInput) {
  const orderRef = await db.collection("purchase_orders").add({
    productId,
    qty,
    tipo,
    withShipping,
    status: "created",
    payment: {
      provider: "mercadopago",
      preferenceId,
    },
    createdAt: FieldValue.serverTimestamp(),
  });

  return orderRef.id;
}