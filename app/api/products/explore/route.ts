import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

// ✅ Caché de 10 segundos (actualización rápida)
export const revalidate = 10;

// ✅ FIX ERROR 18: Cuántos productos devolver por página
const PAGE_SIZE = 20;

export async function GET(req: Request & { nextUrl: { searchParams: URLSearchParams } }) {
  try {
    const { adminDb } = await getAdminServices();

    // ✅ FIX ERROR 18: Leer el parámetro ?page= de la URL (por defecto página 1)
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    // ✅ FIX ERROR 18: En lugar de traer TODOS los productos, usamos .limit() y .offset()
    // para traer solo los productos de la página solicitada.
    // Antes: sin límite → con 1000 productos enviaba 1000 docs de Firestore de una vez.
    // Ahora: solo 20 documentos por llamada.
    const snap = await adminDb
      .collection("products")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")   // ✅ Orden consistente necesario para paginación
      .limit(PAGE_SIZE)
      .offset(offset)
      .get();

    // También contamos el total para que el frontend sepa cuántas páginas hay
    // (Firestore no tiene COUNT nativo eficiente, así que usamos un doc de stats
    // o simplemente dejamos que el frontend sepa si hay más con "hasMore")
    const hasMore = snap.docs.length === PAGE_SIZE;

    const products = snap.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        minimumOrder: data.minimumOrder,
        category: data.category || "otros",
        factoryId: data.factoryId,
        imageUrl: data.imageUrl || null,
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods ?? [],
      };
    });

    return NextResponse.json({
      products,
      page,
      pageSize: PAGE_SIZE,
      hasMore,         // ✅ true si hay más páginas
    });
  } catch (err) {
    console.error("❌ EXPLORE PRODUCTS ERROR:", err);
    return NextResponse.json(
      { error: "Error al cargar productos" },
      { status: 500 }
    );
  }
}