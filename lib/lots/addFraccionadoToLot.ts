import { db } from "../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/* =====================================================
   🔒 SANITIZADOR DE CANTIDAD (FIX CRÍTICO)
===================================================== */
function parseQty(qty: any): number {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("❌ Cantidad inválida en retailerOrder.qty");
  }
  return n;
}

/* =====================================================
   ➕ AGREGAR PEDIDO FRACCIONADO A LOTE
===================================================== */
export async function addFraccionadoToLot({
  productId,
  factoryId,
  MF,
  lotType,
  retailerOrder,
}: {
  productId: string;
  factoryId: string;
  MF: number;
  lotType: "fraccionado_envio" | "fraccionado_retiro";
  retailerOrder: {
    retailerId: string;
    qty: number;
    paymentId: string;
  };
}) {
  const lotsRef = db.collection("lots");

  // 🔒 LOCK ÚNICO POR PRODUCTO + FÁBRICA + TIPO
  const lockId = `${productId}_${factoryId}_${lotType}`;
  const lockRef = db.collection("lotLocks").doc(lockId);

  // 🔑 REFERENCIA AL PAGO (CLAVE DEL FIX)
  const paymentRef = db
    .collection("payments")
    .doc(retailerOrder.paymentId);

  await db.runTransaction(async (tx) => {
    /* ===============================
       0️⃣ IDEMPOTENCIA REAL POR PAGO
       🔒 SI YA FUE APLICADO → SALIR
    =============================== */
    const paymentSnap = await tx.get(paymentRef);
    if (
      paymentSnap.exists &&
      paymentSnap.data()?.appliedToLot === true
    ) {
      return;
    }

    /* ===============================
       1️⃣ LOCK ANTI DUPLICADOS
    =============================== */
    const lockSnap = await tx.get(lockRef);
    if (!lockSnap.exists) {
      tx.set(lockRef, {
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    /* ===============================
       2️⃣ BUSCAR LOTE ACTIVO
    =============================== */
    const activeLotQuery = await tx.get(
      lotsRef
        .where("productId", "==", productId)
        .where("factoryId", "==", factoryId)
        .where("type", "==", lotType)
        .where("status", "==", "accumulating")
        .limit(1)
    );

    // 🔑 CANTIDAD REAL Y SEGURA
    const orderQty = parseQty(retailerOrder.qty);

    /* ===============================
       3️⃣ NO HAY LOTE → CREAR NUEVO
    =============================== */
    if (activeLotQuery.empty) {
      const willClose = orderQty >= MF;
      const newLotRef = lotsRef.doc();

      tx.set(newLotRef, {
        productId,
        factoryId,
        type: lotType,
        MF,
        accumulatedQty: orderQty,
        status: willClose ? "closed" : "accumulating",
        orders: [
          {
            retailerId: retailerOrder.retailerId,
            paymentId: retailerOrder.paymentId,
            qty: orderQty,
          },
        ],
        orderCreated: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        closedAt: willClose ? FieldValue.serverTimestamp() : null,
      });

      // 🔒 MARCAR PAGO COMO APLICADO
      tx.set(
        paymentRef,
        { appliedToLot: true },
        { merge: true }
      );

      return;
    }

    /* ===============================
       4️⃣ HAY LOTE → ACTUALIZAR
    =============================== */
    const lotSnap = activeLotQuery.docs[0];
    const lotRef = lotSnap.ref;
    const lot = lotSnap.data()!;

    // 🛑 EVITAR DUPLICADO (SEGUNDA BARRERA)
    const alreadyExists = (lot.orders || []).some(
      (o: any) => o.paymentId === retailerOrder.paymentId
    );
    if (alreadyExists) {
      tx.set(
        paymentRef,
        { appliedToLot: true },
        { merge: true }
      );
      return;
    }

    const currentQty = Number(lot.accumulatedQty || 0);
    const newQty = currentQty + orderQty;
    const willClose = newQty >= MF;

    tx.update(lotRef, {
      accumulatedQty: newQty,
      orders: FieldValue.arrayUnion({
        retailerId: retailerOrder.retailerId,
        paymentId: retailerOrder.paymentId,
        qty: orderQty,
      }),
      status: willClose ? "closed" : "accumulating",
      updatedAt: FieldValue.serverTimestamp(),
      closedAt: willClose ? FieldValue.serverTimestamp() : null,
    });

    // 🔒 MARCAR PAGO COMO APLICADO (CLAVE ABSOLUTA)
    tx.set(
      paymentRef,
      { appliedToLot: true },
      { merge: true }
    );
  });
}