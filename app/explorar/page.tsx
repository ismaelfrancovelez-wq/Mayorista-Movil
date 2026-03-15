// app/explorar/page.tsx
// ✅ OPTIMIZADO: lee Firestore directamente, solo 20 productos iniciales

import { db } from "../../lib/firebase-admin";
import { ProductCategory, SellerType } from "../../lib/types/product";
import ExplorarClient from "./ExplorarClient";

export const revalidate = 60;

const PAGE_SIZE = 20;

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
  stock?: number | null;
};

async function getInitialProducts(): Promise<Product[]> {
  try {
    const snap = await db
      .collection("products")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE)
      .get();

    if (snap.empty) return [];

    const factoryIds = [
      ...new Set(
        snap.docs.map((doc) => doc.data().factoryId as string).filter(Boolean)
      ),
    ];

    const sellerMap: Record<string, {
      name: string;
      imageUrl: string;
      verified: boolean;
      sellerType: SellerType;
    }> = {};

    if (factoryIds.length > 0) {
      // ✅ Busca con .doc(id).get() igual que explore/route.ts
      // (en vez de where("__name__", "in", chunk) que puede fallar)
      const [manuSnaps, distSnaps, whoSnaps] = await Promise.all([
        Promise.all(factoryIds.map((id) => db.collection("manufacturers").doc(id).get())),
        Promise.all(factoryIds.map((id) => db.collection("distributors").doc(id).get())),
        Promise.all(factoryIds.map((id) => db.collection("wholesalers").doc(id).get())),
      ]);

      manuSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data()!;
          sellerMap[snap.id] = {
            name: data.businessName || data.name || "Fabricante",
            imageUrl: data.profileImageUrl || data.imageUrl || "",
            verified: data.verification?.status === "verified",
            sellerType: "manufacturer",
          };
        }
      });

      distSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data()!;
          sellerMap[snap.id] = {
            name: data.businessName || data.name || "Distribuidor",
            imageUrl: data.profileImageUrl || data.imageUrl || "",
            verified: data.verification?.status === "verified",
            sellerType: "distributor",
          };
        }
      });

      whoSnaps.forEach((snap) => {
        if (snap.exists) {
          const data = snap.data()!;
          sellerMap[snap.id] = {
            name: data.businessName || data.name || "Mayorista",
            imageUrl: data.profileImageUrl || data.imageUrl || "",
            verified: data.verification?.status === "verified",
            sellerType: "wholesaler",
          };
        }
      });
    }

    return snap.docs.map((doc) => {
      const data = doc.data();
      const seller = data.factoryId ? sellerMap[data.factoryId] : null;
      const sellerType = (data.sellerType || seller?.sellerType || "manufacturer") as SellerType;

      return {
        id: doc.id,
        name: data.name || "Producto",
        price: data.price || 0,
        minimumOrder: data.minimumOrder || 0,
        category: (data.category || "otros") as ProductCategory,
        featured: data.featured || false,
        shippingMethods: data.shipping?.methods || [],
        imageUrls: Array.isArray(data.imageUrls) && data.imageUrls.length > 0
          ? data.imageUrls
          : data.imageUrl
          ? [data.imageUrl]
          : [],
        manufacturerName: seller?.name || undefined,
        manufacturerImageUrl: seller?.imageUrl || undefined,
        manufacturerVerified: seller?.verified || false,
        isIntermediary: data.isIntermediary || false,
        unitLabel: data.unitLabel || undefined,
        sellerType,
        variants: Array.isArray(data.variants) ? data.variants : [],
        stock: data.stock !== undefined ? data.stock : null,
      };
    });

  } catch (error) {
    console.error("Error cargando productos:", error);
    return [];
  }
}

export default async function ExplorarPage() {
  const products = await getInitialProducts();
  return <ExplorarClient initialProducts={products} />;
}