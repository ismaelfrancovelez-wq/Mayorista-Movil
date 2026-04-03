// app/api/admin/activate-products/route.ts
// POST: Setea active=true y createdAt en todos los productos que no los tengan.

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const BATCH_SIZE = 500;

export async function POST() {
  try {
    await requireAdmin();

    const snapshot = await db.collection("products").select("active", "createdAt").get();

    const toFix = snapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.active !== true || !data.createdAt;
    });

    if (toFix.length === 0) {
      return NextResponse.json({ updated: 0, message: "Todos los productos ya están correctos." });
    }

    let updated = 0;

    for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
      const chunk = toFix.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const doc of chunk) {
        const data = doc.data();
        const update: Record<string, unknown> = {};
        if (data.active !== true) update.active = true;
        if (!data.createdAt) update.createdAt = FieldValue.serverTimestamp();
        batch.update(doc.ref, update);
      }
      await batch.commit();
      updated += chunk.length;
    }

    return NextResponse.json({ updated, message: `Se corrigieron ${updated} productos.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Error" }, { status: 500 });
  }
}
