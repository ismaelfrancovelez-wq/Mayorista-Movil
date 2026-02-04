import { db } from "../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function getOrCreateOpenLot({
  productId,
  factoryId,
  minimumOrder,
  lotType,
}: {
  productId: string;
  factoryId: string;
  minimumOrder: number;
  lotType: "fractional_shipping" | "fractional_pickup";
}) {
  /**
   * 🔍 BUSCAR LOTE ABIERTO EXISTENTE
   */
  const snap = await db
    .collection("lots")
    .where("productId", "==", productId)
    .where("type", "==", lotType)
    .where("status", "==", "accumulating")
    .limit(1)
    .get();

  if (!snap.empty) {
    const doc = snap.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  /**
   * 🆕 CREAR NUEVO LOTE
   */
  const newLotRef = db.collection("lots").doc();
  const newLot = {
    productId,
    factoryId,
    type: lotType,
    minimumOrder,
    accumulatedQty: 0,
    status: "accumulating",
    orders: [],
    orderCreated: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    closedAt: null,
  };

  await newLotRef.set(newLot);

  return {
    id: newLotRef.id,
    ...newLot,
  };
}