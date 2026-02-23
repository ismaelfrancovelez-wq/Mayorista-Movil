// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function POST() {
  try {
    // ✅ FIX ERROR 17: Antes el logout solo borraba las cookies del navegador.
    // Si alguien tenía una cookie copiada antes del logout, seguía funcionando.
    // Ahora también actualizamos Firestore para dejar registro de que la sesión fue cerrada.
    const userId = cookies().get("userId")?.value;

    if (userId) {
      try {
        // Marcar sesión como cerrada en Firestore
        // Esto permite detectar cookies "viejas" si en el futuro se quiere verificar
        await db.collection("users").doc(userId).update({
          lastLogoutAt: new Date(),
          sessionActive: false,
        });
      } catch (firestoreError) {
        // No bloquear el logout si falla Firestore — las cookies se borran igual
        console.error("⚠️ Error actualizando Firestore en logout:", firestoreError);
      }
    }

    // Eliminar todas las cookies de autenticación del navegador
    cookies().delete("userId");
    cookies().delete("activeRole");
    cookies().delete("token");
    cookies().delete("userEmail"); // ✅ NUEVO

    return NextResponse.json(
      { 
        success: true,
        message: "Sesión cerrada exitosamente" 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    return NextResponse.json(
      { error: "Error al cerrar sesión" },
      { status: 500 }
    );
  }
}