import { db } from "@/lib/firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

/**
 * Pedido individual fraccionado
 */
export type FraccionatedOrder = {
  retailerId: string;
  qty: number;
  paymentId: string;
};

/**
 * Lote fraccionado por producto
 */
export type FraccionatedLot = {
  productId: string;
  factoryId: string;
  MF: number;
  accumulatedQty: number;
  status: "accumulating" | "closed";
  orders: FraccionatedOrder[];

  orderCreated?: boolean; // 🔒 NUEVO (CLAVE)

  createdAt: any;
  updatedAt: any;
  closedAt?: any;
};


/**
 * Agrega pedido fraccionado y CIERRA LOTE automáticamente si corresponde
 */
export async function addFraccionadoToLot(params: {
  productId: string;
  factoryId: string;
  MF: number;
  retailerOrder: FraccionatedOrder;
}) {
  const { productId, factoryId, MF, retailerOrder } = params;

  const lotRef = db.collection("lots").doc(productId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(lotRef);

    // 🆕 Crear lote
    if (!snap.exists) {
      const accumulatedQty = retailerOrder.qty;
      const status = accumulatedQty >= MF ? "closed" : "accumulating";

      tx.set(lotRef, {
        productId,
        factoryId,
        MF,
        accumulatedQty,
        status,
        orders: [retailerOrder],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        closedAt: status === "closed"
          ? FieldValue.serverTimestamp()
          : null,
      });

      return;
    }

    const lot = snap.data() as FraccionatedLot;

    if (lot.status === "closed") return;

    const newQty = lot.accumulatedQty + retailerOrder.qty;
    const newStatus = newQty >= MF ? "closed" : "accumulating";

    tx.update(lotRef, {
      accumulatedQty: newQty,
      orders: FieldValue.arrayUnion(retailerOrder),
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
      closedAt: newStatus === "closed"
        ? FieldValue.serverTimestamp()
        : null,
    });
  });
}
