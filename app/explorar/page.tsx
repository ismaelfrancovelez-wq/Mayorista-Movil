// app/explorar/page.tsx - DISEÑO ORIGINAL + OPTIMIZADO
import { db } from "../../lib/firebase-admin";
import { ProductCategory, CATEGORY_LABELS } from "../../lib/types/product";
import ExplorarClient from "./ExplorarClient";

export const dynamic = 'force-dynamic';
export const revalidate = 10; // ✅ Caché de 10 segundos

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  category: ProductCategory;
  featured: boolean;
  shippingMethods: string[];
  imageUrl?: string;
  // 🆕 Datos del fabricante
  manufacturerName?: string;
  manufacturerImageUrl?: string;
  manufacturerVerified?: boolean;
  isIntermediary?: boolean;
};

async function getProducts(): Promise<Product[]> {
  try {
    const snap = await db
      .collection("products")
      .where("active", "==", true)
      .get();

    // 🆕 Obtener IDs de fabricantes únicos para consulta batch
    const factoryIds = [...new Set(
      snap.docs.map(doc => doc.data().factoryId).filter(Boolean)
    )] as string[];

    // 🆕 Fetch fabricantes en batch (Firestore soporta hasta 10 por 'in')
    const manufacturerMap: Record<string, {
      businessName?: string;
      profileImageUrl?: string;
      verified?: boolean;
    }> = {};

    if (factoryIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < factoryIds.length; i += 10) {
        chunks.push(factoryIds.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const manuSnap = await db
          .collection("manufacturers")
          .where("__name__", "in", chunk)
          .get();
        manuSnap.docs.forEach(doc => {
          const data = doc.data();
          manufacturerMap[doc.id] = {
            businessName: data.businessName || "",
            profileImageUrl: data.profileImageUrl || "",
            verified: data.verification?.status === "verified",
          };
        });
      }
    }

    const products = snap.docs.map((doc) => {
      const data = doc.data();
      const manufacturer = data.factoryId ? manufacturerMap[data.factoryId] : null;
      return {
        id: doc.id,
        name: data.name || "Producto",
        price: data.price || 0,
        minimumOrder: data.minimumOrder || 0,
        category: (data.category || "otros") as ProductCategory,
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods || [],
        imageUrl: data.imageUrl || undefined,
        // 🆕 Fabricante
        manufacturerName: manufacturer?.businessName || undefined,
        manufacturerImageUrl: manufacturer?.profileImageUrl || undefined,
        manufacturerVerified: manufacturer?.verified || false,
        isIntermediary: data.isIntermediary || false,
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