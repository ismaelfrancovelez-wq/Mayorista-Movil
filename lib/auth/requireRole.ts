import { cookies } from "next/headers";
import { db } from "../firebase-admin";

/**
 * ✅ FIX ERROR 19: Validación de rol en BD
 * 
 * Ahora verifica:
 * 1. Que exista userId y activeRole en cookies
 * 2. Que el usuario exista en Firestore
 * 3. Que el usuario tenga el rol requerido asignado en su documento
 * 
 * Esto previene que usuarios manipulen cookies para acceder
 * a funciones que no les corresponden.
 */
export async function requireRole(
  role: "manufacturer" | "retailer"
): Promise<string> {
  const userId = cookies().get("userId")?.value;
  const activeRole = cookies().get("activeRole")?.value;

  // ❌ Validación básica de cookies
  if (!userId || activeRole !== role) {
    throw new Error("No autorizado");
  }

  // ✅ FIX ERROR 19: VALIDAR EN BASE DE DATOS
  try {
    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
      throw new Error("Usuario no encontrado en la base de datos");
    }

    const userData = userSnap.data();

    // Verificar que el usuario tenga el rol requerido
    // El campo puede ser 'usertype' o 'roles' dependiendo de la estructura
    const userType = userData?.usertype;
    const roles = userData?.roles || [];

    // Validar que tenga el rol (ya sea en usertype o en array roles)
    const hasRole =
      userType === role ||
      userType === "both" ||
      roles.includes(role);

    if (!hasRole) {
      throw new Error(`Usuario no tiene el rol '${role}' asignado`);
    }

    // ✅ Usuario válido y autorizado
    return userId;
  } catch (error) {
    console.error("❌ Error en requireRole:", error);
    throw new Error("No autorizado - validación de rol falló");
  }
}