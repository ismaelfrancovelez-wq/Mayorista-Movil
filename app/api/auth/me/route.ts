import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from "next/headers";

export async function GET() {
  const role = cookies().get("activeRole")?.value;
  const userId = cookies().get("userId")?.value;

  if (!userId || !role) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    userId,
    role,
  });
}