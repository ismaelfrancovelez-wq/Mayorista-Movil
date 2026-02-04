import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const checkFeaturedExpiration = functions
  .pubsub.schedule("0 * * * *")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async () => {
    console.log("🕒 Iniciando verificación de destacados vencidos...");

    const now = new Date();
    let expired = 0;
    let productsUpdated = 0;

    try {
      const snapshot = await db
        .collection("featured")
        .where("active", "==", true)
        .where("expired", "==", false)
        .get();

      console.log(`📊 Destacados activos encontrados: ${snapshot.size}`);

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const endDate = data.endDate?.toDate();

        if (!endDate || endDate > now) {
          continue;
        }

        await doc.ref.update({
          expired: true,
          active: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        expired++;
        console.log(`✅ Destacado expirado: ${doc.id} (${data.type})`);

        if (data.type === "product" && data.itemId) {
          try {
            const productRef = db.collection("products").doc(data.itemId);
            const productSnap = await productRef.get();

            if (productSnap.exists) {
              await productRef.update({
                featured: false,
                featuredUntil: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              productsUpdated++;
              console.log(`✅ Producto actualizado: ${data.itemId}`);
            }
          } catch (error) {
            console.error(`❌ Error actualizando producto ${data.itemId}:`, error);
          }
        }
      }

      const summary = {
        timestamp: now.toISOString(),
        totalChecked: snapshot.size,
        expired,
        productsUpdated,
      };

      console.log("📊 RESUMEN:", summary);

      return {
        success: true,
        ...summary,
        message: expired > 0 
          ? `Se expiraron ${expired} destacado(s)` 
          : "No hay destacados para expirar",
      };

    } catch (error) {
      console.error("❌ ERROR en cron:", error);
      throw error;
    }
  });