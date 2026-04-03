// app/api/admin/debug-products/route.ts — SOLO PARA DEBUG, borrar después

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";

export async function GET() {
  try {
    await requireAdmin();

    // Test 1: sin filtros
    const total = await db.collection("products").count().get();

    // Test 2: solo active=true
    let activeCount = 0;
    let activeError = null;
    try {
      const s = await db.collection("products").where("active", "==", true).count().get();
      activeCount = s.data().count;
    } catch (e: any) {
      activeError = e.message;
    }

    // Test 3: active=true + orderBy createdAt (requiere índice)
    let indexedCount = 0;
    let indexedError = null;
    try {
      const s = await db.collection("products")
        .where("active", "==", true)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();
      indexedCount = s.size;
    } catch (e: any) {
      indexedError = e.message;
    }

    return NextResponse.json({
      total: total.data().count,
      activeCount,
      activeError,
      indexedCount,
      indexedError,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
