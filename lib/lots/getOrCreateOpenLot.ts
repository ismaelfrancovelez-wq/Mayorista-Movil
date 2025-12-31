import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function getOrCreateOpenLot({
  productId,
  factoryId,
  MF,
}: {
  productId: string;
  factoryId: string;
  MF: number;
}) {
  // 🔍 Buscar lote abierto
  const snap = await db
    .collection("lots")
    .where("productId", "==", productId)
    .where("status", "==", "open")
    .limit(1)
    .get();

  if (!snap.empty) {
    return {
      id: snap.docs[0].id,
      ...snap.docs[0].data(),
    };
  }

  // 🆕 Crear nuevo lote
  const newLotRef = db.collection("lots").doc();

  const newLot = {
    productId,
    factoryId,
    MF,
    accumulatedQty: 0,
    status: "open",
    orders: [],
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