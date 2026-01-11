import admin from "firebase-admin";
import path from "path";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccountPath = path.join(
    process.cwd(),
    "credentials",
    "firebase-service-account.json"
  );

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// 👇 EXPORTS ESTÁNDAR PARA TODO EL PROYECTO
export const db = admin.firestore();
export const auth = admin.auth(); // ✅ CLAVE

export async function getAdminServices() {
  return {
    adminDb: admin.firestore(),
    adminAuth: admin.auth(),
  };
}