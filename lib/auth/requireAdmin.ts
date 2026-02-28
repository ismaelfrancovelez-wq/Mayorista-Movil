import { cookies } from "next/headers";
import { db } from "../firebase-admin";

export async function requireRole(
  role: "manufacturer" | "retailer"
): Promise<string> {
  const userId = cookies().get("userId")?.value;
  const activeRole = cookies().get("activeRole")?.value;

  // ❌ Validación básica de cookies
  if (!userId || activeRole !== role) {
    throw new Error("No autorizado");
  }

  // ✅ VALIDAR EN BASE DE DATOS
  try {
    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
      throw new Error("Usuario no encontrado en la base de datos");
    }

    const userData = userSnap.data();

    const userType = userData?.usertype;
    const activeRoleDB = userData?.activeRole; // ✅ también leer activeRole de Firestore
    const roles = userData?.roles || [];

    // ✅ Validar rol: acepta usertype, activeRole de Firestore, "both", o array roles
    const hasRole =
      userType === role ||
      userType === "both" ||
      activeRoleDB === role ||
      roles.includes(role);

    if (!hasRole) {
      throw new Error(`Usuario no tiene el rol '${role}' asignado`);
    }

    return userId;
  } catch (error) {
    console.error("❌ Error en requireRole:", error);
    throw new Error("No autorizado - validación de rol falló");
  }
}