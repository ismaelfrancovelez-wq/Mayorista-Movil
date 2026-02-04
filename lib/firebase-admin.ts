import admin from "firebase-admin";
import path from "path";
import fs from "fs";

if (!admin.apps.length) {
  try {
    // 🛠️ DESARROLLO: Intentar usar archivo local primero
    if (process.env.NODE_ENV !== "production") {
      console.log("🔥 Inicializando Firebase Admin desde archivo local...");
      
      const serviceAccountPath = path.join(
        process.cwd(),
        "credentials",
        "firebase-service-account.json"
      );

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, "utf8")
        );

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        console.log("✅ Firebase Admin inicializado correctamente");
      } else {
        throw new Error(
          `❌ Archivo de credenciales no encontrado: ${serviceAccountPath}\n` +
          "Asegúrate de tener el archivo en credentials/firebase-service-account.json"
        );
      }
    } 
    // 🌐 PRODUCCIÓN: Usar variable de entorno
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("🔥 Inicializando Firebase Admin desde ENV...");
      
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("✅ Firebase Admin inicializado correctamente");
    } 
    // ❌ ERROR: Falta configuración en producción
    else {
      throw new Error(
        "❌ Configuración de Firebase Admin faltante en producción.\n" +
        "Configura la variable FIREBASE_SERVICE_ACCOUNT"
      );
    }

  } catch (error) {
    console.error("❌ ERROR CRÍTICO al inicializar Firebase Admin:", error);
    throw error;
  }
}

// Exports estándar
export const db = admin.firestore();
export const auth = admin.auth();

export async function getAdminServices() {
  return {
    adminDb: admin.firestore(),
    adminAuth: admin.auth(),
  };
}
