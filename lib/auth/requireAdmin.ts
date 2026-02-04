// lib/auth/requireAdmin.ts

import { cookies } from "next/headers";
import { db } from "../firebase-admin";

/**
 * Verifica que el usuario sea administrador
 * @returns userId si es admin, lanza error si no
 */
export async function requireAdmin(): Promise<string> {
  const userId = cookies().get("userId")?.value;
  const activeRole = cookies().get("activeRole")?.value;

  if (!userId) {
    throw new Error("No autorizado - no hay sesión");
  }

  // Verificar en base de datos
  try {
    const userSnap = await db.collection("users").doc(userId).get();

    if (!userSnap.exists) {
      throw new Error("Usuario no encontrado");
    }

    const userData = userSnap.data();

    // Verificar rol de admin
    const isAdmin = userData?.isAdmin === true || userData?.role === 'admin';

    if (!isAdmin) {
      throw new Error("No autorizado - requiere privilegios de administrador");
    }

    return userId;
  } catch (error) {
    console.error("❌ Error en requireAdmin:", error);
    throw new Error("No autorizado");
  }
}