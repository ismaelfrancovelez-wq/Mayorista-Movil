// app/api/admin/fix-categories/route.ts
// POST: Recibe un mapping { "valor_incorrecto": "clave_correcta" }
// y actualiza en batch todos los productos con esos valores.

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { mapping } = body as { mapping: Record<string, string> };

    if (!mapping || typeof mapping !== "object" || Object.keys(mapping).length === 0) {
      return NextResponse.json({ error: "mapping requerido" }, { status: 400 });
    }

    const incorrectValues = Object.keys(mapping);
    let totalUpdated = 0;

    // Procesamos de a 500 docs por batch (límite de Firestore)
    for (const incorrectValue of incorrectValues) {
      const correctValue = mapping[incorrectValue];
      const queryValue = incorrectValue === "__null__" ? null : incorrectValue;

      let query = queryValue === null
        ? db.collection("products").where("category", "==", null)
        : db.collection("products").where("category", "==", queryValue);

      let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

      while (true) {
        let q = query.limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);

        const snap = await q.get();
        if (snap.empty) break;

        const batch = db.batch();
        for (const doc of snap.docs) {
          batch.update(doc.ref, { category: correctValue });
        }
        await batch.commit();
        totalUpdated += snap.size;
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < 500) break;
      }
    }

    return NextResponse.json({ ok: true, totalUpdated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Error" }, { status: 500 });
  }
}
