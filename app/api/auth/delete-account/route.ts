// app/api/auth/delete-account/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, auth } from "../../../../lib/firebase-admin";

export async function POST() {
  try {
    const userId = cookies().get("userId")?.value;
    const role = cookies().get("activeRole")?.value;

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Eliminar datos según el rol
    const batch = db.batch();

    // Siempre eliminar: usuario base
    batch.delete(db.collection("users").doc(userId));
    batch.delete(db.collection("userSessions").doc(userId));

    if (role === "manufacturer") {
      // Eliminar perfil de fabricante
      batch.delete(db.collection("manufacturers").doc(userId));

      // Eliminar productos del fabricante
      const productsSnap = await db
        .collection("products")
        .where("factoryId", "==", userId)
        .get();
      productsSnap.docs.forEach(doc => batch.delete(doc.ref));

      // Eliminar solicitudes de verificación
      const verSnap = await db
        .collection("verification_requests")
        .where("manufacturerId", "==", userId)
        .get();
      verSnap.docs.forEach(doc => batch.delete(doc.ref));

      // Eliminar destacados
      const featuredSnap = await db
        .collection("featured")
        .where("factoryId", "==", userId)
        .get();
      featuredSnap.docs.forEach(doc => batch.delete(doc.ref));

    } else if (role === "retailer") {
      // Eliminar perfil de revendedor
      batch.delete(db.collection("retailers").doc(userId));
    }

    await batch.commit();

    // Eliminar de Firebase Auth
    try {
      await auth.deleteUser(userId);
    } catch (authErr) {
      console.error("Error eliminando usuario de Auth (puede que ya no exista):", authErr);
    }

    // Limpiar cookies
    cookies().delete("userId");
    cookies().delete("activeRole");
    cookies().delete("token");

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error eliminando cuenta:", error);
    return NextResponse.json(
      { error: "Error al eliminar la cuenta" },
      { status: 500 }
    );
  }
}