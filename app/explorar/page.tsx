// app/explorar/page.tsx

import { db } from "../../lib/firebase-admin";
import { ProductCategory, SellerType } from "../../lib/types/product";
import ExplorarClient from "./ExplorarClient";

// ✅ revalidate = 0 para que el nombre del vendedor siempre esté actualizado
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
};

async function getProducts(): Promise<Product[]> {
  try {
    const snap = await db
      .collection("products")
      .where("active", "==", true)
      .get();

    const factoryIds = [...new Set(
      snap.docs.map(doc => doc.data().factoryId).filter(Boolean)
    )] as string[];

    // ✅ CORREGIDO: buscar vendedores en las 3 colecciones
    const sellerMap: Record<string, {
      businessName?: string;
      profileImageUrl?: string;
      verified?: boolean;
      sellerType?: SellerType;
    }> = {};

    if (factoryIds.length > 0) {
      // Dividir en chunks de 10 (límite de Firestore)
      const chunks: string[][] = [];
      for (let i = 0; i < factoryIds.length; i += 10) {
        chunks.push(factoryIds.slice(i, i + 10));
      }

      // Buscar en las 3 colecciones en paralelo
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
            // Solo sobreescribir si no hay datos de manufacturer
            // (un usuario solo puede estar en una colección)
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

    const products = snap.docs.map((doc) => {
      const data = doc.data();
      const seller = data.factoryId ? sellerMap[data.factoryId] : null;

      // ✅ El sellerType puede venir del producto (más confiable) o del mapa
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
        // ✅ NUEVO: sellerType y variants para mostrar en las cards
        sellerType: sellerType as SellerType,
        variants: Array.isArray(data.variants) ? data.variants : [],
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