// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Eliminar todas las cookies de autenticación
    cookies().delete("userId");
    cookies().delete("activeRole");
    cookies().delete("token");

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