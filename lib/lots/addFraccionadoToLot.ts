import { db } from "../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/* =====================================================
   🔒 SANITIZADOR DE CANTIDAD (FIX CRÍTICO)
===================================================== */
function parseQty(qty: any): number {
  const n = Number(qty);
  
  if (!Number.isFinite(n)) {
    throw new Error(`❌ Cantidad inválida: ${qty} no es un número`);
  }
  
  if (n <= 0) {
    throw new Error(`❌ Cantidad inválida: ${qty} debe ser mayor a 0`);
  }
  
  if (!Number.isInteger(n)) {
    throw new Error(`❌ Cantidad inválida: ${qty} debe ser un número entero`);
  }
  
  if (n > 1000000) {
    throw new Error(`❌ Cantidad inválida: ${qty} es demasiado grande`);
  }
  
  return n;
}

/* =====================================================
   ➕ AGREGAR PEDIDO FRACCIONADO A LOTE
===================================================== */
export async function addFraccionadoToLot({
  productId,
  factoryId,
  minimumOrder, // ✅ Nombre estandarizado
  lotType,
  retailerOrder,
}: {
  productId: string;
  factoryId: string;
  minimumOrder: number; // ✅ En vez de MF
  lotType: "fractional_pickup" | "fractional_shipping"; // ✅ Solo fraccionados
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

  // 🔒 REFERENCIA AL PAGO (CLAVE DEL FIX)
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
      console.log("✋ Pago ya aplicado al lote");
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

    // 🔒 CANTIDAD REAL Y SEGURA
    const orderQty = parseQty(retailerOrder.qty);

    /* ===============================
       3️⃣ NO HAY LOTE → CREAR NUEVO
    =============================== */
    if (activeLotQuery.empty) {
      const willClose = orderQty >= minimumOrder;
      const newLotRef = lotsRef.doc();

      tx.set(newLotRef, {
        productId,
        factoryId,
        type: lotType,
        minimumOrder, // ✅ Nombre estandarizado
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

      console.log(`📦 Nuevo lote creado: ${newLotRef.id}`);
      console.log(`   Status: ${willClose ? "closed" : "accumulating"}`);
      console.log(`   Qty: ${orderQty}/${minimumOrder}`);

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
      console.log("✋ Pedido ya existe en el lote");
      tx.set(
        paymentRef,
        { appliedToLot: true },
        { merge: true }
      );
      return;
    }

    const currentQty = Number(lot.accumulatedQty || 0);
    const newQty = currentQty + orderQty;
    const willClose = newQty >= minimumOrder;

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

    console.log(`📦 Lote actualizado: ${lotSnap.id}`);
    console.log(`   Status: ${willClose ? "closed" : "accumulating"}`);
    console.log(`   Qty: ${newQty}/${minimumOrder}`);

    // 🔒 MARCAR PAGO COMO APLICADO (CLAVE ABSOLUTA)
    tx.set(
      paymentRef,
      { appliedToLot: true },
      { merge: true }
    );
  });
}