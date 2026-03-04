import { cookies } from "next/headers";
import { db } from "../firebase-admin";

export async function requireRole(
  role: "manufacturer" | "retailer" | "distributor" | "wholesaler" | string[]
): Promise<string> {
  const userId = cookies().get("userId")?.value;
  const activeRole = cookies().get("activeRole")?.value;

  // Normalizar a array para comparación uniforme
  const allowedRoles = Array.isArray(role) ? role : [role];

  // ❌ Validación básica de cookies
  if (!userId || !activeRole || !allowedRoles.includes(activeRole)) {
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
    const activeRoleDB = userData?.activeRole;
    const roles = userData?.roles || [];

    // ✅ Validar que tiene alguno de los roles permitidos
    const hasRole =
      allowedRoles.includes(userType) ||
      userType === "both" ||
      allowedRoles.includes(activeRoleDB) ||
      allowedRoles.some((r) => roles.includes(r));

    if (!hasRole) {
      throw new Error(`Usuario no tiene ninguno de los roles permitidos`);
    }

    return userId;
  } catch (error) {
    console.error("❌ Error en requireRole:", error);
    throw new Error("No autorizado - validación de rol falló");
  }
}

// ✅ Helper para los 3 roles vendedores (fabricante, distribuidor, mayorista)
export async function requireSellerRole(): Promise<string> {
  return requireRole(["manufacturer", "distributor", "wholesaler"]);
}