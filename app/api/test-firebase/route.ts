import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  const snap = await db.collection("lots").limit(1).get();
  return NextResponse.json({ ok: true, size: snap.size });
}