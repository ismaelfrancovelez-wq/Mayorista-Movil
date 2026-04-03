import { NextResponse } from "next/server";
import { getAdminServices } from "../../../../lib/firebase-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const VALID_CATEGORIES = new Set([
  "hogar", "electronica", "indumentaria", "calzado",
  "alimentos", "bebidas", "construccion", "salud_belleza",
  "jugueteria", "libreria", "deportes", "automotor",
  "mascotas", "otros",
]);

export async function GET(req: Request) {
  try {
    const { adminDb } = await getAdminServices();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    // ✅ FIX: el offset usa PAGE_SIZE real, no PAGE_SIZE*3
    const offset = (page - 1) * PAGE_SIZE;

    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];

    const categoryParam = searchParams.get("category") || "";
    const category = VALID_CATEGORIES.has(categoryParam) ? categoryParam : "";

    let snap;

    if (ids.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) {
        chunks.push(ids.slice(i, i + 30));
      }
      const snaps = await Promise.all(
        chunks.map((chunk) =>
          adminDb.collection("products").where("__name__", "in", chunk).get()
        )
      );
      snap = { docs: snaps.flatMap((s) => s.docs) };

    } else if (search) {
      let query = adminDb
        .collection("products")
        .where("active", "==", true)
        .where("nameLower", ">=", search)
        .where("nameLower", "<=", search + "\uf8ff");

      if (category) {
        query = query.where("category", "==", category);
      }

      snap = await query.limit(100).get();

    } else if (category) {
      // ✅ FIX: pedir PAGE_SIZE+1 para saber si hay más, no PAGE_SIZE*3
      snap = await adminDb
        .collection("products")
        .where("active", "==", true)
        .where("category", "==", category)
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE + 1)
        .offset(offset)
        .get();

    } else {
      // ✅ FIX: pedir PAGE_SIZE+1 para saber si hay más, no PAGE_SIZE*3
      snap = await adminDb
        .collection("products")
        .where("active", "==", true)
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE + 1)
        .offset(offset)
        .get();
    }

    const isNormalMode = !search && ids.length === 0;

    // ✅ FIX: hasMore se calcula correctamente — si trajo PAGE_SIZE+1 hay más
    const hasMore = isNormalMode && snap.docs.length > PAGE_SIZE;

    // Cortar al tamaño real de página
    const docs = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;

    const productIds = docs.map((doc) => doc.id);
    const accumulatedMap = new Map<string, number>();

    if (isNormalMode && productIds.length > 0) {
      const lotChunks: string[][] = [];
      for (let i = 0; i < productIds.length; i += 10) {
        lotChunks.push(productIds.slice(i, i + 10));
      }
      const lotSnaps = await Promise.all(
        lotChunks.map((chunk) =>
          adminDb
            .collection("lots")
            .where("productId", "in", chunk)
            .where("status", "in", ["open", "accumulating"])
            .get()
        )
      );
      lotSnaps.flatMap((s) => s.docs).forEach((doc) => {
        const data = doc.data();
        const pid = data.productId as string;
        const qty = data.accumulatedQty || 0;
        accumulatedMap.set(pid, (accumulatedMap.get(pid) || 0) + qty);
      });
    }

    const factoryIds = [
      ...new Set(
        docs
          .map((doc) => doc.data().factoryId as string)
          .filter(Boolean)
      ),
    ];

    const sellerDataMap: Record<string, {
      name: string;
      imageUrl?: string;
      verified?: boolean;
      sellerType: string;
    }> = {};

    if (factoryIds.length > 0) {
      const [manufacturerSnaps, distributorSnaps, wholesalerSnaps] = await Promise.all([
        Promise.all(factoryIds.map((id: string) => adminDb.collection("manufacturers").doc(id).get())),
        Promise.all(factoryIds.map((id: string) => adminDb.collection("distributors").doc(id).get())),
        Promise.all(factoryIds.map((id: string) => adminDb.collection("wholesalers").doc(id).get())),
      ]);

      manufacturerSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data();
          sellerDataMap[snap.id] = {
            name: data?.businessName || data?.name || "Fabricante",
            imageUrl: data?.profileImageUrl || data?.imageUrl || null,
            verified: data?.verification?.status === "verified",
            sellerType: "manufacturer",
          };
        }
      });

      distributorSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data();
          sellerDataMap[snap.id] = {
            name: data?.businessName || data?.name || "Distribuidor",
            imageUrl: data?.profileImageUrl || data?.imageUrl || null,
            verified: data?.verification?.status === "verified",
            sellerType: "distributor",
          };
        }
      });

      wholesalerSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data();
          sellerDataMap[snap.id] = {
            name: data?.businessName || data?.name || "Mayorista",
            imageUrl: data?.profileImageUrl || data?.imageUrl || null,
            verified: data?.verification?.status === "verified",
            sellerType: "wholesaler",
          };
        }
      });
    }

    const products = docs.map((doc) => {
      const data = doc.data();
      const factoryId = data.factoryId;
      const seller = sellerDataMap[factoryId];
      const sellerType = data.sellerType || seller?.sellerType || "manufacturer";

      const rawCategory = data.category || "";
      const normalizedCategory = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "otros";

      return {
        id: doc.id,
        name: data.name,
        price: data.price,
        minimumOrder: data.minimumOrder,
        category: normalizedCategory,
        factoryId,
        imageUrls: Array.isArray(data.imageUrls) && data.imageUrls.length > 0
          ? data.imageUrls
          : data.imageUrl
          ? [data.imageUrl]
          : [],
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods ?? [],
        unitLabel: data.unitLabel || null,
        isIntermediary: data.isIntermediary || false,
        variants: Array.isArray(data.variants) ? data.variants : [],
        sellerType,
        manufacturerName: seller?.name || null,
        manufacturerImageUrl: seller?.imageUrl || null,
        manufacturerVerified: seller?.verified || false,
        stock: data.stock !== undefined ? data.stock : null,
        accumulatedQty: accumulatedMap.get(doc.id) || 0,
        retailReferencePrice: data.retailReferencePrice ?? null,
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