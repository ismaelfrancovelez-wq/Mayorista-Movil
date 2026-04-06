// scripts/migrate-libreria-to-limpieza.ts
// Migra todos los productos con category "libreria" a "limpieza"
// Ejecutar con: npx ts-node --project tsconfig.scripts.json scripts/migrate-libreria-to-limpieza.ts

import { db } from "../lib/firebase-admin";

async function migrate() {
  console.log("🔍 Buscando productos con category='libreria'...");

  const snap = await db
    .collection("products")
    .where("category", "==", "libreria")
    .get();

  if (snap.empty) {
    console.log("✅ No hay productos con category='libreria'. Nada que migrar.");
    return;
  }

  console.log(`📦 Encontrados ${snap.size} productos. Migrando...`);

  const batch = db.batch();
  let count = 0;

  snap.docs.forEach((doc) => {
    batch.update(doc.ref, { category: "limpieza" });
    count++;
    console.log(`  → ${doc.id}: ${doc.data().name || "sin nombre"}`);
  });

  await batch.commit();
  console.log(`\n✅ ${count} productos migrados de "libreria" a "limpieza".`);
}

migrate().catch((err) => {
  console.error("❌ Error migrando:", err);
  process.exit(1);
});