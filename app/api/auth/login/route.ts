// app/api/auth/login/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth, db } from "../../../../lib/firebase-admin";

// ✅ FIX ERROR 11: Duración de la sesión — 7 días en segundos
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Token requerido" },
        { status: 400 }
      );
    }

    // 🔐 Verificar token Firebase (Admin SDK)
    const decoded = await auth.verifyIdToken(idToken);
    const userId = decoded.uid;

    // 🔎 Buscar usuario en Firestore
    const userSnap = await db
      .collection("users")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return NextResponse.json(
        { error: "Usuario no registrado" },
        { status: 403 }
      );
    }

    const user = userSnap.docs[0].data();
    const activeRole = user.activeRole || user.usertype;

    // 🍪 Cookies — ✅ FIX ERROR 11: Agregar maxAge para que persistan tras cerrar el browser
    cookies().set("userId", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,  // ✅ FIX: sin esto las cookies expiraban al cerrar el browser
    });

    cookies().set("activeRole", activeRole, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,  // ✅ FIX: sin esto las cookies expiraban al cerrar el browser
    });

    // ✅ NUEVO: guardar email para mostrarlo en el dashboard sin consultar Firestore
    if (decoded.email) {
      cookies().set("userEmail", decoded.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
    }

    return NextResponse.json({
      success: true,
      role: activeRole,
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }
}