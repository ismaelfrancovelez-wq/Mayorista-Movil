// app/explorar/page.tsx
// ✅ BLOQUE C: pasa solo price BASE a ExplorarClient. El componente
// calcula el precio publicado en runtime (price * 1.04).

import { cookies } from "next/headers";
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
  accumulatedQty?: number;
  retailReferencePrice?: number | null;
};

type RetailerPanelData = {
  userId: string;
  userEmail: string;
  userName: string;
  activeRole: string;
  hasAddress: boolean;
  hasOrders: boolean;
  milestoneBadges: string[];
  streakBadges: string[];
  currentStreak: number;
  paymentLevel: number;
  completedLots: number;
  scoreValue: number;
};

async function getRetailerPanelData(): Promise<RetailerPanelData | null> {
  const cookieStore = cookies();
  const userId = cookieStore.get("userId")?.value;
  const activeRole = cookieStore.get("activeRole")?.value;

  if (!userId || activeRole !== "retailer") return null;

  const userEmail = cookieStore.get("userEmail")?.value || "";
  const userName = cookieStore.get("userName")?.value || "";

  const [userSnap, retailerSnap, paymentsSnap] = await Promise.all([
    db.collection("users").doc(userId).get(),
    db.collection("retailers").doc(userId).get(),
    db.collection("payments").where("buyerId", "==", userId).limit(1).get(),
  ]);

  const retailerData = retailerSnap.data() || {};
  const userData = userSnap.data() || {};

  const hasAddress = !!(
    retailerData.address?.formattedAddress ||
    retailerData.address?.lat
  );
  const hasOrders = !paymentsSnap.empty;

  return {
    userId,
    userEmail: userEmail || userData.email || "",
    userName: userName || userData.name || "",
    activeRole: "retailer",
    hasAddress,
    hasOrders,
    milestoneBadges: retailerData.milestoneBadges ?? [],
    streakBadges: retailerData.streakBadges ?? [],
    currentStreak: retailerData.currentStreak ?? 0,
    paymentLevel: retailerData.paymentLevel ?? 2,
    completedLots: retailerData.completedReservations ?? 0,
    scoreValue: retailerData.scoreAggregate?.score ?? 0.5,
  };
}

async function getInitialProducts(): Promise<{ products: Product[]; hasMore: boolean }> {
  try {
    const snap = await db
      .collection("products")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(PAGE_SIZE + 1)
      .get();

    if (snap.empty) return { products: [], hasMore: false };

    const hasMore = snap.docs.length > PAGE_SIZE;
    const docs = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;

    const productIds = docs.map((doc) => doc.id);

    const accumulatedMap = new Map<string, number>();
    const lotChunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 10) {
      lotChunks.push(productIds.slice(i, i + 10));
    }
    const lotSnaps = await Promise.all(
      lotChunks.map((chunk) =>
        db.collection("lots")
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

    const factoryIds = [
      ...new Set(
        docs.map((doc) => doc.data().factoryId as string).filter(Boolean)
      ),
    ];

    const sellerMap: Record<string, {
      name: string;
      imageUrl: string;
      verified: boolean;
      sellerType: SellerType;
    }> = {};

    if (factoryIds.length > 0) {
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

    const products: Product[] = docs.map((doc) => {
      const data = doc.data();
      const seller = data.factoryId ? sellerMap[data.factoryId] : null;
      const sellerType = (data.sellerType || seller?.sellerType || "manufacturer") as SellerType;

      return {
        id: doc.id,
        name: data.name || "Producto",
        price: data.price || 0, // ✅ BLOQUE C: solo BASE
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
        accumulatedQty: accumulatedMap.get(doc.id) || 0,
        retailReferencePrice: data.retailReferencePrice ?? null,
      };
    });

    products.sort((a, b) => (b.accumulatedQty || 0) - (a.accumulatedQty || 0));

    return { products, hasMore };

  } catch (error) {
    console.error("Error cargando productos:", error);
    return { products: [], hasMore: false };
  }
}

export default async function ExplorarPage() {
  const [{ products, hasMore }, retailerPanel] = await Promise.all([
    getInitialProducts(),
    getRetailerPanelData(),
  ]);

  return (
    <ExplorarClient
      initialProducts={products}
      initialHasMore={hasMore}
      retailerPanel={retailerPanel}
    />
  );
}