// app/api/admin/debug-products/route.ts — SOLO PARA DEBUG, borrar después

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";

export async function GET() {
  try {
    await requireAdmin();

    // Muestra los primeros 10 productos con active=true y sus campos clave
    const snap = await db.collection("products")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const samples = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        category: d.category,
        active: d.active,
        createdAt: d.createdAt?.toDate?.() ?? d.createdAt,
      };
    });

    // Cuenta por categoría (exacta) en los primeros 200 docs activos
    const snap2 = await db.collection("products")
      .where("active", "==", true)
      .limit(200)
      .get();

    const catCounts: Record<string, number> = {};
    snap2.docs.forEach(doc => {
      const cat = doc.data().category ?? "__null__";
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    });

    return NextResponse.json({ samples, catCounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
