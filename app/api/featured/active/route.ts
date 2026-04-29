import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase-admin";
import { FeaturedType } from "../../../../lib/types/featured";


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as FeaturedType | null;

    if (!type || !["product", "factory"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo requerido (product o factory)" },
        { status: 400 }
      );
    }

    const now = new Date();

    const snap = await db
      .collection("featured")
      .where("type", "==", type)
      .where("active", "==", true)
      .where("expired", "==", false)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const items: any[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const endDate = data.endDate?.toDate();

      if (endDate && endDate < now) {
        await doc.ref.update({
          expired: true,
          active: false,
          updatedAt: new Date(),
        });
        continue;
      }

      let itemData: any = null;

      if (type === "product") {
        const productSnap = await db.collection("products").doc(data.itemId).get();
        if (productSnap.exists) {
          const p = productSnap.data()!;
          itemData = {
            id: productSnap.id,
            name: p.name,
            price: p.price,
            displayPrice: p.displayPrice ?? null, // ✅ BLOQUE 4e: precio con 4% MP
            minimumOrder: p.minimumOrder,
            category: p.category,
          };
        }
      } else {
        const factorySnap = await db.collection("manufacturers").doc(data.itemId).get();
        if (factorySnap.exists) {
          const f = factorySnap.data()!;
          itemData = {
            id: factorySnap.id,
            name: f.businessName || f.name || "Fábrica",
            description: f.description || "",
            address: f.address?.formattedAddress || "",
          };
        }
      }

      if (itemData) {
        items.push({
          id: doc.id,
          type: data.type,
          itemId: data.itemId,
          endDate: endDate?.toISOString(),
          metadata: data.metadata,
          itemData,
        });
      }
    }

    return NextResponse.json({
      type,
      items,
    });
  } catch (error) {
    console.error("Error obteniendo destacados activos:", error);
    return NextResponse.json(
      { error: "Error al obtener destacados activos" },
      { status: 500 }
    );
  }
}