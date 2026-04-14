// scripts/delete-food-products.ts
//
// Borra todos los productos de las categorías: bebidas, alimentos, almacen
// Total estimado: ~3.695 productos
//
// ── CÓMO CORRERLO ───────────────────────────────────────────────────────────
//   npx ts-node --project tsconfig.scripts.json scripts/delete-food-products.ts
//
// ── FLAGS ───────────────────────────────────────────────────────────────────
//   --dry-run    Solo muestra cuántos borraría, sin borrar nada
//
// ── IMPORTANTE ──────────────────────────────────────────────────────────────
//   Esta operación NO tiene vuelta atrás en Firestore.
//   Asegurate de tener el products-export.json como backup antes de correr.

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const serviceAccountPath = path.join(process.cwd(), "credentials", "firebase-service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("\n❌ No se encontró credentials/firebase-service-account.json\n");
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

const CATEGORIES_TO_DELETE = ["bebidas", "alimentos", "almacen"];
const isDryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  delete-food-products — MayoristaMovil");
  console.log("════════════════════════════════════════════════════════");
  console.log(`  Modo:       ${isDryRun ? "🔍 DRY RUN (no borra nada)" : "🗑️  BORRADO REAL"}`);
  console.log(`  Categorías: ${CATEGORIES_TO_DELETE.join(", ")}`);
  console.log("════════════════════════════════════════════════════════\n");

  // Traer todos los productos de esas categorías
  console.log("📥 Consultando Firestore...");

  const snapshots = await Promise.all(
    CATEGORIES_TO_DELETE.map((cat) =>
      db.collection("products").where("category", "==", cat).get()
    )
  );

  const allDocs = snapshots.flatMap((s) => s.docs);

  // Deduplicar por ID (por si algún producto cayera en múltiples queries)
  const uniqueMap = new Map(allDocs.map((d) => [d.id, d]));
  const docs = Array.from(uniqueMap.values());

  console.log(`\n🎯 Productos encontrados para borrar: ${docs.length}`);

  if (docs.length === 0) {
    console.log("✅ No hay productos en esas categorías. Nada que hacer.\n");
    process.exit(0);
  }

  // Mostrar resumen por categoría
  const byCategory: Record<string, number> = {};
  docs.forEach((d) => {
    const cat = d.data().category || "sin_categoria";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });
  console.log("\n  Por categoría:");
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`    ${cat}: ${count}`);
  });

  if (isDryRun) {
    console.log("\n  ℹ️  DRY RUN: no se borró nada.");
    console.log("  Corré sin --dry-run para borrar de verdad.\n");
    process.exit(0);
  }

  // Borrar en batches de 400 (límite seguro de Firestore)
  console.log("\n🗑️  Borrando...");
  const BATCH_SIZE = 400;
  let totalDeleted = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += chunk.length;
    console.log(`  ✅ ${totalDeleted}/${docs.length} productos borrados`);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log(`  ✅ Listo. ${totalDeleted} productos borrados de Firestore.`);
  console.log("════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});