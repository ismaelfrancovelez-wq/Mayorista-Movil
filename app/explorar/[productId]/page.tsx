// app/explorar/[productId]/page.tsx
// ✅ ACTUALIZADO: soporte para fabricante, distribuidor y mayorista
// ✅ FIX: agregado generateMetadata para SEO por producto

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { db } from "../../../lib/firebase-admin";
import type { Product } from "../../../lib/types/product";
import type { Metadata } from "next";
import ProductPurchaseClient from "../../../components/products/ProductPurchaseClient";
import ImageCarousel from "../../../components/products/ImageCarousel";
import Link from "next/link";
import VariantSelectorClient from "../../../components/products/VariantSelectorClient";

export const revalidate = 30;

async function getProduct(
  productId: string
): Promise<(Product & { id: string }) | null> {
  const snap = await db.collection("products").doc(productId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Product;
  return { id: snap.id, ...data };
}

// ✅ FIX: generateMetadata dinámico — genera title, description y OG por producto
// No modifica ninguna lógica existente, solo agrega este export
export async function generateMetadata({
  params,
}: {
  params: { productId: string };
}): Promise<Metadata> {
  const product = await getProduct(params.productId);

  if (!product) {
    return {
      title: "Producto no encontrado",
      description: "Este producto no está disponible en MayoristaMovil.",
    };
  }

  const name = (product.name || "Producto").replace(/\s*\[[^\]]+\]\s*/g, "").trim();
  const price = product.price?.toLocaleString("es-AR") ?? "";
  const minimumOrder = product.minimumOrder ?? 0;
  const category = (product as any).category ?? "";

  const title = `${name} — Precio mayorista $${price} | MayoristaMovil`;
  const description = `Comprá ${name} a precio de fábrica desde ${minimumOrder} unidades. ${
    category ? `Categoría: ${category}. ` : ""
  }Lotes fraccionados disponibles. Fábricas verificadas en Argentina.`;

  const imageUrls: string[] =
    Array.isArray((product as any).imageUrls) && (product as any).imageUrls.length > 0
      ? (product as any).imageUrls
      : (product as any).imageUrl
      ? [(product as any).imageUrl]
      : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_AR",
      siteName: "MayoristaMovil",
      images: imageUrls.length > 0
        ? [{ url: imageUrls[0], width: 800, height: 600, alt: name }]
        : [{ url: "/og-image.png", width: 1200, height: 630, alt: "MayoristaMovil" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrls.length > 0 ? [imageUrls[0]] : ["/og-image.png"],
    },
  };
}

// ✅ Sin cambios: todo lo de abajo es idéntico al original

async function getSellerInfo(factoryId: string, sellerType?: string) {
  const collectionsToTry: { collection: string; label: string }[] = [];

  if (sellerType === "distributor") {
    collectionsToTry.push({ collection: "distributors", label: "Distribuidor" });
  } else if (sellerType === "wholesaler") {
    collectionsToTry.push({ collection: "wholesalers", label: "Mayorista" });
  } else if (sellerType === "manufacturer") {
    collectionsToTry.push({ collection: "manufacturers", label: "Fabricante" });
  } else {
    collectionsToTry.push(
      { collection: "manufacturers", label: "Fabricante" },
      { collection: "distributors", label: "Distribuidor" },
      { collection: "wholesalers", label: "Mayorista" }
    );
  }

  for (const { collection, label } of collectionsToTry) {
    const snap = await db.collection(collection).doc(factoryId).get();
    if (snap.exists) {
      const data = snap.data();
      const isVerified = data?.verification?.status === "verified";
      return {
        businessName: data?.businessName || label,
        profileImageUrl: data?.profileImageUrl || "",
        address: data?.address || null,
        phone: data?.phone || "",
        email: data?.email || "",
        schedule: data?.schedule || null,
        verified: isVerified,
        sellerType: collection === "manufacturers"
          ? "manufacturer"
          : collection === "distributors"
          ? "distributor"
          : "wholesaler",
        sellerLabel: label,
      };
    }
  }

  return null;
}

async function getFraccionadoProgress(productId: string) {
  const headersList = headers();
  const host = headersList.get("host");
  if (!host) return null;
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const res = await fetch(
    `${protocol}://${host}/api/lots/fraccionado/progress?productId=${productId}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function ProductDetailPage({
  params,
}: {
  params: { productId: string };
}) {
  const product = await getProduct(params.productId);
  const progressData = await getFraccionadoProgress(params.productId);
  const userId = cookies().get("userId")?.value;

  if (!product) {
    return <div className="p-8">Producto no encontrado</div>;
  }

  const sellerInfo = await getSellerInfo(
    product.factoryId,
    (product as any).sellerType
  );

  const minimumOrder = Number(product.minimumOrder) || 0;

  const images: string[] =
    Array.isArray((product as any).imageUrls) && (product as any).imageUrls.length > 0
      ? (product as any).imageUrls
      : (product as any).imageUrl
      ? [(product as any).imageUrl]
      : [];

  const shippingMethods: string[] = product.shipping?.methods ?? [];
  const allowPickup = shippingMethods.includes("factory_pickup");
  const allowFactoryShipping =
    shippingMethods.includes("own_logistics") ||
    shippingMethods.includes("third_party");
  const noShipping = product.shipping?.noShipping === true;
  const unitLabel: string | null = (product as any).unitLabel || null;
  const hasFactoryAddress = !!(
    sellerInfo?.address?.formattedAddress ||
    sellerInfo?.address?.lat
  );

  const variants: { unitLabel: string; price: number; minimumOrder: number }[] =
    Array.isArray((product as any).variants) ? (product as any).variants : [];

  const allVariants = [
    {
      unitLabel: unitLabel || "",
      price: product.price,
      minimumOrder: minimumOrder,
      isBase: true,
    },
    ...variants.map(v => ({ ...v, isBase: false })),
  ];

  const hasVariants = variants.length > 0;

  const sellerBadgeColors: Record<string, string> = {
    manufacturer: "bg-blue-100 text-blue-800",
    distributor: "bg-purple-100 text-purple-800",
    wholesaler: "bg-green-100 text-green-800",
  };
  const sellerColor = sellerInfo
    ? sellerBadgeColors[sellerInfo.sellerType] || "bg-gray-100 text-gray-800"
    : "bg-gray-100 text-gray-800";

  // ✅ FIX: nombre limpio sin SKU para mostrar al usuario
  const cleanName = (product.name || "").replace(/\s*\[[^\]]+\]\s*/g, "").trim();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">

        <Link
          href="/explorar"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4 text-sm"
        >
          ← Volver a explorar
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid lg:grid-cols-[52%_48%]">

            <div className="border-r border-gray-100 flex flex-col">

              <div style={{ height: "360px" }}>
                {images.length > 0 ? (
                  <ImageCarousel images={images} productName={cleanName} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <svg
                      className="w-24 h-24 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {product.description && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    Descripción
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

            </div>

            <div className="px-5 py-4 flex flex-col overflow-y-auto">

              {/* ✅ FIX: usar cleanName en lugar de product.name para ocultar SKU */}
              <h1 className="text-lg font-semibold text-gray-900 leading-snug mb-2">
                {cleanName}
              </h1>

              {hasVariants ? (
                <VariantSelectorClient
                  allVariants={allVariants}
                  progressData={progressData}
                  productId={product.id}
                  factoryId={product.factoryId}
                  allowPickup={allowPickup}
                  allowFactoryShipping={allowFactoryShipping}
                  hasFactoryAddress={hasFactoryAddress}
                  noShipping={noShipping}
                  userId={userId}
                />
              ) : (
                <>
                  <div className="mb-3">
                    <p className="text-3xl font-light text-gray-900 leading-none">
                      ${product.price.toLocaleString("es-AR")}
                      {unitLabel && (
                        <span className="text-base font-normal text-gray-500 ml-1">
                          / {unitLabel}
                        </span>
                      )}
                    </p>
                    {unitLabel && (
                      <p className="text-xs text-gray-400 mt-1">precio por {unitLabel}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Pedido mínimo</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {minimumOrder} uds.
                      </p>
                      {unitLabel && (
                        <p className="text-xs text-gray-500 mt-0.5">{unitLabel} c/u</p>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Precio mínimo total</p>
                      <p className="text-xl font-semibold text-gray-900">
                        ${(product.price * minimumOrder).toLocaleString("es-AR")}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {minimumOrder} × ${product.price.toLocaleString("es-AR")}
                      </p>
                    </div>
                  </div>

                  {progressData && (progressData.withShipping.MF > 0 || progressData.withoutShipping.MF > 0) && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-3">
                      <h3 className="font-semibold text-xs mb-2 text-blue-900">📦 Progreso del lote</h3>

                      {progressData.withShipping.MF > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>🚚 Con envío</span>
                            <span>{progressData.withShipping.accumulatedQty} / {progressData.withShipping.MF} uds.</span>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progressData.withShipping.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {progressData.withoutShipping.MF > 0 && (
                        <div>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>🏪 Retiro</span>
                            <span>{progressData.withoutShipping.accumulatedQty} / {progressData.withoutShipping.MF} uds.</span>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progressData.withoutShipping.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {userId && (
                    <ProductPurchaseClient
                      price={product.price}
                      MF={minimumOrder}
                      productId={product.id}
                      factoryId={product.factoryId}
                      allowPickup={allowPickup}
                      allowFactoryShipping={allowFactoryShipping}
                      hasFactoryAddress={hasFactoryAddress}
                      noShipping={noShipping}
                      unitLabel={unitLabel || undefined}
                    />
                  )}
                </>
              )}

              {sellerInfo && (
                <div className="border-t border-gray-100 pt-3 mb-3 mt-3">
                  <h3 className="text-xs font-semibold text-gray-900 mb-2">
                    Información del {sellerInfo.sellerLabel}
                  </h3>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-shrink-0">
                      <div className={`w-9 h-9 rounded-full p-0.5 ${sellerInfo.verified ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <div className="w-full h-full rounded-full overflow-hidden bg-white">
                          {sellerInfo.profileImageUrl ? (
                            <img
                              src={sellerInfo.profileImageUrl}
                              alt={sellerInfo.businessName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                              {sellerInfo.businessName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      {sellerInfo.verified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-gray-900">{sellerInfo.businessName}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${sellerColor}`}>
                          {sellerInfo.sellerLabel}
                        </span>
                        {sellerInfo.verified && (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                            ✓ Verificado
                          </span>
                        )}
                        {product.isIntermediary && (
                          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                            Intermediario
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-700">
                    <p>
                      <span className="font-medium">Empresa:</span>{" "}
                      {sellerInfo.businessName}
                    </p>
                    {sellerInfo.email && (
                      <p>
                        <span className="font-medium">Email:</span>{" "}
                        {sellerInfo.email}
                      </p>
                    )}
                    {sellerInfo.phone && (
                      <p>
                        <span className="font-medium">Teléfono:</span>{" "}
                        {sellerInfo.phone}
                      </p>
                    )}
                    {sellerInfo.verified && (
                      <div className="flex items-center gap-1.5 text-green-600 mt-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium">{sellerInfo.sellerLabel} Verificado</span>
                      </div>
                    )}
                    {product.isIntermediary && (
                      <div className="flex items-center gap-1.5 text-blue-600 mt-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        <span className="text-xs font-medium">Intermediario</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}