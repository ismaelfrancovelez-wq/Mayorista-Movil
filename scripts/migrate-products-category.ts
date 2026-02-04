import admin from "firebase-admin";
import path from "path";
import fs from "fs";

function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath = path.join(
    process.cwd(),
    "credentials",
    "firebase-service-account.json"
  );

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `❌ Archivo de credenciales no encontrado: ${serviceAccountPath}\n` +
      "Asegurate de tener el archivo en credentials/firebase-service-account.json"
    );
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.app();
}

async function migrateProducts() {
  console.log("🚀 Iniciando migración de productos...\n");

  try {
    initFirebase();
    const db = admin.firestore();

    const productsSnapshot = await db.collection("products").get();

    console.log(`📦 Productos encontrados: ${productsSnapshot.size}\n`);

    if (productsSnapshot.empty) {
      console.log("⚠️  No hay productos para migrar");
      return;
    }

    let updated = 0;
    let alreadyHaveCategory = 0;

    for (const doc of productsSnapshot.docs) {
      try {
        const data = doc.data();

        if (data.category) {
          alreadyHaveCategory++;
          console.log(`✓ ${doc.id} - Ya tiene categoría: ${data.category}`);
          continue;
        }

        await doc.ref.update({
          category: "otros",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        updated++;
        console.log(`✅ ${doc.id} - Categoría agregada: "otros"`);
      } catch (error) {
        console.error(`❌ Error en producto ${doc.id}:`, error);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 RESUMEN DE MIGRACIÓN");
    console.log("=".repeat(50));
    console.log(`Total de productos:           ${productsSnapshot.size}`);
    console.log(`✅ Actualizados:               ${updated}`);
    console.log(`✓  Ya tenían categoría:        ${alreadyHaveCategory}`);
    console.log("=".repeat(50) + "\n");
    console.log("🎉 Migración completada exitosamente!\n");

  } catch (error) {
    console.error("\n❌ ERROR CRÍTICO:", error);
    process.exit(1);
  }
}

migrateProducts()
  .then(() => {
    console.log("✅ Proceso finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });