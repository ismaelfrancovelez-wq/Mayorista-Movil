// app/api/featured/my-featured/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const userId = cookies().get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();

    // Sin orderBy para evitar requerir índice compuesto
    const byFactoryId = await db
      .collection("featured")
      .where("factoryId", "==", userId)
      .get();

    const byItemId = await db
      .collection("featured")
      .where("itemId", "==", userId)
      .get();

    // Unir sin duplicados
    const seen = new Set<string>();
    const allDocs = [...byFactoryId.docs, ...byItemId.docs].filter(doc => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });

    const items: any[] = [];

    for (const doc of allDocs) {
      const data = doc.data();
      const endDate = data.endDate?.toDate
        ? data.endDate.toDate()
        : new Date(data.endDate);

      if (endDate < now && data.active) {
        await doc.ref.update({ expired: true, active: false, updatedAt: new Date() });
      }

      const isActive = endDate >= now && data.active && !data.expired;
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      items.push({
        id: doc.id,
        type: data.type,
        itemId: data.itemId,
        active: isActive,
        expired: !isActive,
        endDate: endDate.toISOString(),
        daysLeft,
        metadata: data.metadata || {},
      });
    }

    // Ordenar en memoria: activos primero, luego por fecha
    items.sort((a, b) => {
      if (b.active !== a.active) return b.active ? 1 : -1;
      return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error obteniendo mis destacados:", error);
    return NextResponse.json(
      { error: "Error obteniendo destacados" },
      { status: 500 }
    );
  }
}