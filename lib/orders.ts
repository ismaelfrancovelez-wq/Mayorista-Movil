// lib/orders.ts
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { FraccionatedLot } from "@/lib/lots";

/**
 * Crea una order FINAL cuando un lote fraccionado se cierra
 * ⚠️ Se ejecuta UNA sola vez por lote
 */
export async function createOrderFromClosedLot(lot: FraccionatedLot) {
  // 🛑 Seguridad absoluta
  if (lot.status !== "closed") return;
  if (lot.orderCreated === true) return;

  // 🔒 Evitar duplicados por seguridad extra
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
  "El revendedor " + o.retailerId + " no tiene direccion cargada"
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

  // 📦 Crear order FINAL (lo que ve la fábrica)
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

  // 🔒 Marcar lote como procesado
  await db
    .collection("lots")
    .doc(lot.productId)
    .update({
      orderCreated: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
}