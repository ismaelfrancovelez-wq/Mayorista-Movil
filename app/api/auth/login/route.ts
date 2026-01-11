import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Token requerido" },
        { status: 400 }
      );
    }

    /* ===============================
       🔐 VERIFICAR TOKEN FIREBASE
       (Admin SDK - producción)
    =============================== */
    const decoded = await auth.verifyIdToken(idToken);

    /* ===============================
       🍪 COOKIE SEGURA
       (usada por dashboard y middleware)
    =============================== */
    cookies().set("retailerId", decoded.uid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }
}