export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth, db } from "../../../../lib/firebase-admin";

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

    // 🍪 Cookies
    cookies().set("userId", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    cookies().set("activeRole", activeRole, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

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