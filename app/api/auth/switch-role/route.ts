import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { role } = await req.json();

  if (!role || !["manufacturer", "retailer"].includes(role)) {
    return NextResponse.json(
      { error: "Rol inválido" },
      { status: 400 }
    );
  }

  cookies().set("activeRole", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ success: true });
}