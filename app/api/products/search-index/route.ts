// app/api/products/search-index/route.ts
// ✅ Nueva API — devuelve solo { id, name } de todos los productos activos
// Es ultra liviano (~150kb para 5100 productos)
// El cliente lo carga una vez al entrar a /explorar y busca en memoria

import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

export const revalidate = 300; // cachear 5 minutos

export async function GET() {
  try {
    const { adminDb } = await getAdminServices();

    // .select("name") hace que Firestore devuelva solo ese campo — muy liviano
    const snap = await adminDb
      .collection("products")
      .where("active", "==", true)
      .select("name")
      .get();

    const index = snap.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "",
    }));

    return NextResponse.json(
      { index },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("❌ SEARCH INDEX ERROR:", err);
    return NextResponse.json({ index: [] }, { status: 500 });
  }
}