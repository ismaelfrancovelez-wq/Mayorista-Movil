// app/api/admin/activate-products/route.ts
// POST: Setea active=true en todos los productos que no lo tienen.
// Solo ejecutar una vez como migración.

import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/requireAdmin";
import { db } from "../../../../lib/firebase-admin";

const BATCH_SIZE = 500;

export async function POST() {
  try {
    await requireAdmin();

    const snapshot = await db.collection("products").select("active").get();

    const toActivate = snapshot.docs.filter((doc) => doc.data().active !== true);

    if (toActivate.length === 0) {
      return NextResponse.json({ updated: 0, message: "Todos los productos ya tienen active=true." });
    }

    let updated = 0;

    for (let i = 0; i < toActivate.length; i += BATCH_SIZE) {
      const chunk = toActivate.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.update(doc.ref, { active: true });
      }
      await batch.commit();
      updated += chunk.length;
    }

    return NextResponse.json({ updated, message: `Se activaron ${updated} productos.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Error" }, { status: 500 });
  }
}
