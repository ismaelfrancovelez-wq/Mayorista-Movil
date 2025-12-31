import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getOrCreateOpenLot } from "./getOrCreateOpenLot";

export async function addFraccionadoToLot({
  productId,
  factoryId,
  MF,
  retailerOrder,
}: {
  productId: string;
  factoryId: string;
  MF: number;
  retailerOrder: {
    retailerId: string;
    qty: number;
    paymentId: string;
  };
}) {
  const lot = await getOrCreateOpenLot({
    productId,
    factoryId,
    MF,
  });

  const lotRef = db.collection("lots").doc(lot.id);

  await db.runTransaction(async (tx) => {
    const lotSnap = await tx.get(lotRef);

    if (!lotSnap.exists) {
      throw new Error("Lote no encontrado");
    }

    const lotData = lotSnap.data()!;

    // 🔁 Evitar pagos duplicados
    const alreadyExists = (lotData.orders || []).some(
      (o: any) => o.paymentId === retailerOrder.paymentId
    );

    if (alreadyExists) {
      return;
    }

    const newAccumulated =
      (lotData.accumulatedQty || 0) + retailerOrder.qty;

    const updatedOrders = [
      ...(lotData.orders || []),
      {
        paymentId: retailerOrder.paymentId,
        retailerId: retailerOrder.retailerId,
        qty: retailerOrder.qty,
      },
    ];

    const updateData: any = {
      accumulatedQty: newAccumulated,
      orders: updatedOrders,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 🔒 Cerrar lote si alcanza MF
    if (newAccumulated >= lotData.MF) {
      updateData.status = "closed";
      updateData.closedAt = FieldValue.serverTimestamp();
    }

    tx.update(lotRef, updateData);
  });
}