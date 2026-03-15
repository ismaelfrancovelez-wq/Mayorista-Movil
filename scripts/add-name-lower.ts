// scripts/add-name-lower.ts
//
// ✅ SCRIPT DE MIGRACIÓN — correr UNA SOLA VEZ
// Agrega el campo "nameLower" a todos los productos existentes
//
// CÓMO CORRERLO desde la raíz del proyecto:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/add-name-lower.ts

import { db } from "../lib/firebase-admin";

async function main() {
  console.log("🚀 Iniciando migración...");

  const snap = await db.collection("products").get();
  console.log(`📦 Total productos: ${snap.docs.length}`);

  let updated = 0;
  let skipped = 0;

  const BATCH_SIZE = 400;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of chunk) {
      const data = doc.data();
      const correctNameLower = (data.name || "").toLowerCase().trim();

      if (data.nameLower === correctNameLower) {
        skipped++;
        continue;
      }

      batch.update(doc.ref, { nameLower: correctNameLower });
      batchCount++;
      updated++;
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batchCount} productos actualizados`);
    }
  }

  console.log(`\n📊 Resumen: ${updated} actualizados, ${skipped} ya estaban ok`);
  console.log("🎉 Migración completada.");
}

main().catch(console.error);