import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function GET() {
  const role = cookies().get("activeRole")?.value;
  const userId = cookies().get("userId")?.value;

  if (!userId || !role) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  // ✅ Verificar que el userId de la cookie exista en Firestore
  try {
    const userSnap = await db
      .collection("users")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("❌ Error verificando usuario en Firestore:", error);
    return NextResponse.json(
      { error: "Error de autenticación" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    userId,
    role,
    // ✅ NUEVO: también devolver activeRole para compatibilidad con páginas que lo usan
    activeRole: role,
  });
}