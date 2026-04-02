// app/api/admin/category-audit/route.ts
// GET: Agrupa todos los productos por el valor exacto del campo "category"
// para detectar valores incorrectos en Firestore.

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";

export async function GET() {
  try {
    await requireAdmin();

    const snapshot = await db.collection("products").select("category", "name").get();

    const counts: Record<string, number> = {};
    const examples: Record<string, string[]> = {};

    for (const doc of snapshot.docs) {
      const raw = doc.data().category;
      const key = raw === undefined || raw === null ? "__null__" : String(raw);
      counts[key] = (counts[key] ?? 0) + 1;
      if (!examples[key]) examples[key] = [];
      if (examples[key].length < 3) examples[key].push(doc.data().name || doc.id);
    }

    const result = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count, examples: examples[value] ?? [] }));

    return NextResponse.json({ total: snapshot.size, categories: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Error" }, { status: 500 });
  }
}
