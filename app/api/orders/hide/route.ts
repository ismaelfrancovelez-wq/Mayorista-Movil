import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "../../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ── 1. AUTH ──────────────────────────────────────────────────────────
    const userId = cookies().get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // ── 2. BODY ──────────────────────────────────────────────────────────
    const { itemId } = await req.json();
    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId requerido" }, { status: 400 });
    }

    // ── 3. AGREGAR A LISTA DE OCULTOS ─────────────────────────────────────
    // Usamos arrayUnion para no duplicar si ya está en la lista
    await db.collection("users").doc(userId).update({
      hiddenOrders: FieldValue.arrayUnion(itemId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`🙈 Usuario ${userId} ocultó el item: ${itemId}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("❌ Error ocultando pedido:", error);
    return NextResponse.json(
      { error: "Error al ocultar el pedido. Intentá de nuevo." },
      { status: 500 }
    );
  }
}