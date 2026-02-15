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
};

async function getProducts(): Promise<Product[]> {
  try {
    const snap = await db
      .collection("products")
      .where("active", "==", true)
      .get();

    const products = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Producto",
        price: data.price || 0,
        minimumOrder: data.minimumOrder || 0,
        category: (data.category || "otros") as ProductCategory,
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods || [],
        imageUrl: data.imageUrl || undefined,
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