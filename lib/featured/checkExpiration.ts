import { db } from "../../lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function checkFeaturedExpiration() {
  const now = Timestamp.now();

  const snap = await db
    .collection("products")
    .where("isFeatured", "==", true)
    .get();

  for (const doc of snap.docs) {
    const product = doc.data();
    const ref = doc.ref;

    if (!product.featuredUntil) continue;

    const diffMs =
      product.featuredUntil.toMillis() - now.toMillis();
    const daysLeft = Math.ceil(
      diffMs / (1000 * 60 * 60 * 24)
    );

    const alerts = product.featuredAlerts || {};

    // ⚠️ 3 días antes
    if (daysLeft === 3 && !alerts.warned3d) {
      console.log(`⚠️ Aviso 3 días: ${product.name}`);
      await ref.update({
        "featuredAlerts.warned3d": true,
      });
    }

    // ⛔ 1 día antes
    if (daysLeft === 1 && !alerts.warned1d) {
      console.log(`⛔ Aviso 1 día: ${product.name}`);
      await ref.update({
        "featuredAlerts.warned1d": true,
      });
    }

    // ❌ Vencido
    if (daysLeft <= 0) {
      console.log(`❌ Destacado vencido: ${product.name}`);
      await ref.update({
        isFeatured: false,
        featuredUntil: null,
        featuredAlerts: FieldValue.delete(),
      });
    }
  }
}