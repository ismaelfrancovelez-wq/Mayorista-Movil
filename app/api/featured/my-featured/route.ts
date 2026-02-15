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

    // Buscar destacados donde el fabricante es el dueño
    // Para fábricas: factoryId == userId
    // Para productos: necesitamos buscar por itemId en productos del fabricante
    const snap = await db
      .collection("featured")
      .where("factoryId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const items: any[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);

      // Marcar como expirado si ya venció
      if (endDate < now && data.active) {
        await doc.ref.update({ expired: true, active: false, updatedAt: new Date() });
        items.push({
          id: doc.id,
          type: data.type,
          itemId: data.itemId,
          active: false,
          expired: true,
          endDate: endDate.toISOString(),
          metadata: data.metadata || {},
        });
        continue;
      }

      items.push({
        id: doc.id,
        type: data.type,
        itemId: data.itemId,
        active: data.active,
        expired: data.expired,
        endDate: endDate.toISOString(),
        metadata: data.metadata || {},
      });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error obteniendo mis destacados:", error);
    return NextResponse.json(
      { error: "Error obteniendo destacados" },
      { status: 500 }
    );
  }
}