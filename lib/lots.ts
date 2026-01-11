import { db } from "../lib/firebase-admin";
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
 * Lote fraccionado (retiro o envío)
 */
export type FraccionatedLot = {
  productId: string;
  factoryId: string;
  type: "fraccionado_retiro" | "fraccionado_envio";
  MF: number;
  accumulatedQty: number;
  status: "accumulating" | "closed";
  orders: FraccionatedOrder[];

  orderCreated?: boolean;

  createdAt: any;
  updatedAt: any;
  closedAt?: any;
};

type AddFraccionadoParams = {
  productId: string;
  factoryId: string;
  MF: number;
  lotType: "fraccionado_retiro" | "fraccionado_envio";
  retailerOrder: FraccionatedOrder;
};

/**
 * Agrega pedido fraccionado al lote ACTIVO
 * - Si no hay lote activo → crea uno nuevo
 * - Si el lote alcanza MF → se cierra
 * - Los lotes cerrados NO se reutilizan
 */
export async function addFraccionadoToLot(
  params: AddFraccionadoParams
) {
  const {
    productId,
    factoryId,
    MF,
    lotType,
    retailerOrder,
  } = params;

  // 🔒 FIX CRÍTICO — factoryId SIEMPRE obligatorio
  if (!factoryId) {
    throw new Error(
      "factoryId es obligatorio para pedidos fraccionados"
    );
  }

  const lotsRef = db.collection("lots");

  await db.runTransaction(async (tx: Transaction) => {
    /**
     * 🔍 Buscar lote ACTIVO (MISMO producto + fábrica + tipo)
     */
    const activeLotQuery = await tx.get(
      lotsRef
        .where("productId", "==", productId)
        .where("factoryId", "==", factoryId)
        .where("type", "==", lotType)
        .where("status", "==", "accumulating")
        .limit(1)
    );

    /**
     * 🆕 NO existe lote activo → crear uno nuevo
     */
    if (activeLotQuery.empty) {
      const newLotRef = lotsRef.doc();

      const accumulatedQty = retailerOrder.qty;
      const status =
        accumulatedQty >= MF ? "closed" : "accumulating";

      tx.set(newLotRef, {
        productId,
        factoryId,
        type: lotType,
        MF,
        accumulatedQty,
        status,
        orders: [retailerOrder],
        orderCreated: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        closedAt:
          status === "closed"
            ? FieldValue.serverTimestamp()
            : null,
      });

      return;
    }

    /**
     * ➕ Usar lote activo existente
     */
    const lotSnap = activeLotQuery.docs[0];
    const lotRef = lotSnap.ref;
    const lot = lotSnap.data() as FraccionatedLot;

    const newQty = lot.accumulatedQty + retailerOrder.qty;
    const newStatus =
      newQty >= MF ? "closed" : "accumulating";

    tx.update(lotRef, {
      accumulatedQty: newQty,
      orders: FieldValue.arrayUnion(retailerOrder),
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
      closedAt:
        newStatus === "closed"
          ? FieldValue.serverTimestamp()
          : null,
    });
  });
}