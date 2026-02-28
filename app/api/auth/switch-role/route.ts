import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  const { role } = await req.json();

  if (!role || !["manufacturer", "retailer"].includes(role)) {
    return NextResponse.json(
      { error: "Rol inválido" },
      { status: 400 }
    );
  }

  // ✅ Actualizar cookiee
  cookies().set("activeRole", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  // ✅ Actualizar activeRole en Firestore también
  const userId = cookies().get("userId")?.value;
  if (userId) {
    await db.collection("users").doc(userId).update({
      activeRole: role,
    });
  }

  return NextResponse.json({ success: true });
}