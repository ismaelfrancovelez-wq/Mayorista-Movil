import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

export const dynamic = "force-dynamic";

// Cuántos productos devolver por página
const PAGE_SIZE = 20;

export async function GET(req: Request) {
  try {
    const { adminDb } = await getAdminServices();

    // Leer el parámetro ?page= de la URL (por defecto página 1)
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    const snap = await adminDb
      .collection("products")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE)
      .offset(offset)
      .get();

    const hasMore = snap.docs.length === PAGE_SIZE;

    // ✅ PASO 1: Recolectar todos los factoryId únicos de los productos
    // para no hacer una consulta por cada producto individualmente
    const factoryIds = [
      ...new Set(snap.docs.map((doc) => doc.data().factoryId).filter(Boolean)),
    ];

    // ✅ PASO 2: Buscar el vendedor en las 3 colecciones posibles
    // según el sellerType guardado en el producto.
    // Traemos todos los documentos de una sola vez por colección.
    const sellerDataMap: Record<string, { name: string; imageUrl?: string; verified?: boolean; sellerType: string }> = {};

    if (factoryIds.length > 0) {
      // Buscar en manufacturers
      const manufacturerSnaps = await Promise.all(
        factoryIds.map((id) => adminDb.collection("manufacturers").doc(id).get())
      );
      manufacturerSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data();
          sellerDataMap[snap.id] = {
            name: data?.businessName || data?.name || "Fabricante",
            imageUrl: data?.imageUrl || null,
            verified: data?.verified || false,
            sellerType: "manufacturer",
          };
        }
      });

      // Buscar en distributors
      const distributorSnaps = await Promise.all(
        factoryIds.map((id) => adminDb.collection("distributors").doc(id).get())
      );
      distributorSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data();
          sellerDataMap[snap.id] = {
            name: data?.businessName || data?.name || "Distribuidor",
            imageUrl: data?.imageUrl || null,
            verified: data?.verified || false,
            sellerType: "distributor",
          };
        }
      });

      // Buscar en wholesalers
      const wholesalerSnaps = await Promise.all(
        factoryIds.map((id) => adminDb.collection("wholesalers").doc(id).get())
      );
      wholesalerSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data();
          sellerDataMap[snap.id] = {
            name: data?.businessName || data?.name || "Mayorista",
            imageUrl: data?.imageUrl || null,
            verified: data?.verified || false,
            sellerType: "wholesaler",
          };
        }
      });
    }

    // ✅ PASO 3: Armar la respuesta combinando producto + datos del vendedor
    const products = snap.docs.map((doc) => {
      const data = doc.data();
      const factoryId = data.factoryId;

      // Buscar datos del vendedor en el mapa que armamos arriba
      const seller = sellerDataMap[factoryId];

      // ✅ El sellerType puede venir del producto directamente (guardado en Paso 4)
      // o del mapa de vendedores si el producto es más viejo y no lo tiene
      const sellerType = data.sellerType || seller?.sellerType || "manufacturer";

      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        minimumOrder: data.minimumOrder,
        category: data.category || "otros",
        factoryId,
        // ✅ compatibilidad: soporta imageUrls (array nuevo) e imageUrl (string viejo)
        imageUrls: Array.isArray(data.imageUrls) && data.imageUrls.length > 0
          ? data.imageUrls
          : data.imageUrl
          ? [data.imageUrl]
          : [],
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods ?? [],
        unitLabel: data.unitLabel || null,
        isIntermediary: data.isIntermediary || false,
        // ✅ NUEVO: variantes para mostrar medidas y precios en la card del explorador
        variants: Array.isArray(data.variants) ? data.variants : [],

        // ✅ datos del vendedor para mostrar en el explorador
        sellerType,
        manufacturerName: seller?.name || null,
        manufacturerImageUrl: seller?.imageUrl || null,
        manufacturerVerified: seller?.verified || false,
      };
    });

    return NextResponse.json({
      products,
      page,
      pageSize: PAGE_SIZE,
      hasMore,
    });
  } catch (err) {
    console.error("❌ EXPLORE PRODUCTS ERROR:", err);
    return NextResponse.json(
      { error: "Error al cargar productos" },
      { status: 500 }
    );
  }
}