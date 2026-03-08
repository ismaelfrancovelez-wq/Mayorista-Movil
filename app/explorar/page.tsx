// app/explorar/page.tsx
// ✅ MODIFICADO:
//   - Trae productos active=true Y los con stock=0 (para mostrarlos con badge "Sin stock")
//   - Pasa el campo "stock" a cada producto para que ExplorarClient muestre el badge

import { db } from "../../lib/firebase-admin";
import { ProductCategory, SellerType } from "../../lib/types/product";
import ExplorarClient from "./ExplorarClient";

export const revalidate = 0;

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  category: ProductCategory;
  featured: boolean;
  shippingMethods: string[];
  imageUrls?: string[];
  manufacturerName?: string;
  manufacturerImageUrl?: string;
  manufacturerVerified?: boolean;
  isIntermediary?: boolean;
  unitLabel?: string;
  sellerType?: SellerType;
  variants?: { unitLabel: string; price: number; minimumOrder: number }[];
  stock?: number | null; // ✅ NUEVO
};

async function getProducts(): Promise<Product[]> {
  try {
    // ✅ MODIFICADO: dos queries para no perder productos con stock=0
    // Query 1: todos los productos activos (active=true)
    // Query 2: productos con stock=0 (por compatibilidad con productos viejos que quedaron active=false)
    const [activeSnap, outOfStockSnap] = await Promise.all([
      db.collection("products").where("active", "==", true).get(),
      db.collection("products").where("stock", "==", 0).get(),
    ]);

    // Unir sin duplicados usando un Map
    const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    activeSnap.docs.forEach(doc => docsMap.set(doc.id, doc));
    outOfStockSnap.docs.forEach(doc => docsMap.set(doc.id, doc));
    const allDocs = Array.from(docsMap.values());

    const factoryIds = [...new Set(
      allDocs.map(doc => doc.data().factoryId).filter(Boolean)
    )] as string[];

    const sellerMap: Record<string, {
      businessName?: string;
      profileImageUrl?: string;
      verified?: boolean;
      sellerType?: SellerType;
    }> = {};

    if (factoryIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < factoryIds.length; i += 10) {
        chunks.push(factoryIds.slice(i, i + 10));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          const [manuSnap, distSnap, whoSnap] = await Promise.all([
            db.collection("manufacturers").where("__name__", "in", chunk).get(),
            db.collection("distributors").where("__name__", "in", chunk).get(),
            db.collection("wholesalers").where("__name__", "in", chunk).get(),
          ]);

          manuSnap.docs.forEach(doc => {
            const data = doc.data();
            sellerMap[doc.id] = {
              businessName: data.businessName || "",
              profileImageUrl: data.profileImageUrl || "",
              verified: data.verification?.status === "verified",
              sellerType: "manufacturer",
            };
          });

          distSnap.docs.forEach(doc => {
            const data = doc.data();
            sellerMap[doc.id] = {
              businessName: data.businessName || "",
              profileImageUrl: data.profileImageUrl || "",
              verified: data.verification?.status === "verified",
              sellerType: "distributor",
            };
          });

          whoSnap.docs.forEach(doc => {
            const data = doc.data();
            sellerMap[doc.id] = {
              businessName: data.businessName || "",
              profileImageUrl: data.profileImageUrl || "",
              verified: data.verification?.status === "verified",
              sellerType: "wholesaler",
            };
          });
        })
      );
    }

    const products = allDocs.map((doc) => {
      const data = doc.data();
      const seller = data.factoryId ? sellerMap[data.factoryId] : null;
      const sellerType = data.sellerType || seller?.sellerType || "manufacturer";

      return {
        id: doc.id,
        name: data.name || "Producto",
        price: data.price || 0,
        minimumOrder: data.minimumOrder || 0,
        category: (data.category || "otros") as ProductCategory,
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods || [],
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : undefined,
        manufacturerName: seller?.businessName || undefined,
        manufacturerImageUrl: seller?.profileImageUrl || undefined,
        manufacturerVerified: seller?.verified || false,
        isIntermediary: data.isIntermediary || false,
        unitLabel: data.unitLabel || undefined,
        sellerType: sellerType as SellerType,
        variants: Array.isArray(data.variants) ? data.variants : [],
        // ✅ NUEVO: pasar el stock al cliente
        // null = sin control (siempre disponible, no muestra badge)
        // 0    = sin stock (muestra badge rojo "Sin stock")
        // >0   = con stock disponible (no muestra badge)
        stock: data.stock !== undefined ? data.stock : null,
      };
    });

    return products;
  } catch (error) {
    console.error("Error cargando productos:", error);
    return [];
  }
}

export default async function ExplorarPage() {
  const products = await getProducts();
  return <ExplorarClient initialProducts={products} />;
}