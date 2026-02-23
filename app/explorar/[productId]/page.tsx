// app/explorar/[productId]/page.tsx
// ✅ ACTUALIZADO:
//    - Carrusel de imágenes (múltiples fotos del fabricante)
//    - Shipping props pasados a ProductPurchaseClient:
//        allowPickup / allowFactoryShipping / hasFactoryAddress
//    - Bloqueo de compra si fabricante no tiene dirección

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { db } from "../../../lib/firebase-admin";
import type { Product } from "../../../lib/types/product";
import ProductPurchaseClient from "../../../components/products/ProductPurchaseClient";
import ShippingSimulatorSection from "../../../components/ShippingSimulatorSection";
import ImageCarousel from "../../../components/products/ImageCarousel";
import Link from "next/link";

// ✅ OPTIMIZACIÓN: Caché de 30 segundos
export const revalidate = 30;

/* ===============================
    📍 OBTENER PRODUCTO
================================ */
async function getProduct(
  productId: string
): Promise<(Product & { id: string }) | null> {
  const snap = await db.collection("products").doc(productId).get();

  if (!snap.exists) return null;

  const data = snap.data() as Product;

  return {
    id: snap.id,
    ...data,
  };
}

/* ===============================
    🏢 OBTENER INFO DEL FABRICANTE
================================ */
async function getManufacturerInfo(factoryId: string) {
  console.log("🔍 Buscando manufacturer con ID:", factoryId);
  
  const snap = await db.collection("manufacturers").doc(factoryId).get();
  
  if (!snap.exists) {
    console.log("❌ Manufacturer NO encontrado");
    return null;
  }
  
  const data = snap.data();
  
  const isVerified = data?.verification?.status === "verified";
  
  console.log("✅ Manufacturer encontrado:", {
    businessName: data?.businessName,
    verificationStatus: data?.verification?.status,
    isVerified: isVerified,
  });
  
  return {
    businessName: data?.businessName || "Fabricante",
    profileImageUrl: data?.profileImageUrl || "",
    address: data?.address || null,
    phone: data?.phone || "",
    email: data?.email || "",
    schedule: data?.schedule || null,
    verified: isVerified,
  };
}

/* ===============================
    📦 PROGRESO FRACCIONADO
================================ */
async function getFraccionadoProgress(productId: string) {
  const headersList = headers();
  const host = headersList.get("host");

  if (!host) return null;

  const protocol =
    process.env.NODE_ENV === "development" ? "http" : "https";

  const res = await fetch(
    `${protocol}://${host}/api/lots/fraccionado/progress?productId=${productId}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;

  return res.json();
}

/* ===============================
    🧾 PAGE (SERVER COMPONENT)
================================ */
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

  const manufacturerInfo = await getManufacturerInfo(product.factoryId);

  const minimumOrder = Number(product.minimumOrder) || 0;

  // ✅ Array de imágenes — soporta imageUrls[] (nuevo) e imageUrl string (legacy)
  const images: string[] =
    Array.isArray((product as any).imageUrls) && (product as any).imageUrls.length > 0
      ? (product as any).imageUrls
      : (product as any).imageUrl
      ? [(product as any).imageUrl]
      : [];

  /* ===============================
     🚚 PERMISOS DE SHIPPING
  ================================ */
  const shippingMethods: string[] = product.shipping?.methods ?? [];

  const allowPickup = shippingMethods.includes("factory_pickup");

  const allowFactoryShipping =
    shippingMethods.includes("own_logistics") ||
    shippingMethods.includes("third_party");

  const hasFactoryAddress = !!(
    manufacturerInfo?.address?.formattedAddress ||
    manufacturerInfo?.address?.lat
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">

        <Link
          href="/explorar"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6"
        >
          ← Volver a explorar
        </Link>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid lg:grid-cols-[55%_45%] gap-0">

            {/* COLUMNA IZQUIERDA — IMAGEN */}
            <div className="bg-gray-50 border-r border-gray-100">
              <div style={{ minHeight: "500px" }} className="sticky top-6">
                {images.length > 0 ? (
                  <ImageCarousel images={images} productName={product.name} />
                ) : (
                  <div
                    className="w-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200"
                    style={{ minHeight: "500px" }}
                  >
                    <svg
                      className="w-32 h-32 text-gray-400"
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
            </div>

            {/* COLUMNA DERECHA — INFO */}
            <div className="p-8 overflow-y-auto">

              {/* NOMBRE Y PRECIO */}
              <div className="mb-6 pb-6 border-b border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
                  {product.name}
                </h1>
                <p className="text-4xl font-bold text-gray-900">
                  ${product.price.toLocaleString("es-AR")}
                </p>
              </div>

              {/* DESCRIPCIÓN */}
              {product.description && (
                <div className="mb-6 pb-6 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Descripción
                  </h3>
                  <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* PEDIDO MÍNIMO */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-500 mb-1">Pedido mínimo</p>
                <p className="text-2xl font-bold text-gray-900">
                  {minimumOrder} unidades
                </p>
              </div>

              {/* PROGRESO FRACCIONADO */}
              {progressData && progressData.accumulatedQty > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-lg mb-3">📦 Progreso Fraccionado</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {progressData.accumulatedQty} / {minimumOrder} unidades acumuladas
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((progressData.accumulatedQty / minimumOrder) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* INFO DEL FABRICANTE */}
              {manufacturerInfo && (
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Información del Fabricante
                  </h3>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full p-0.5 ${manufacturerInfo.verified ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <div className="w-full h-full rounded-full overflow-hidden bg-white">
                          {manufacturerInfo.profileImageUrl ? (
                            <img
                              src={manufacturerInfo.profileImageUrl}
                              alt={manufacturerInfo.businessName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-500">
                              {manufacturerInfo.businessName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      {manufacturerInfo.verified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{manufacturerInfo.businessName}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {manufacturerInfo.verified && (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                            ✓ Verificado
                          </span>
                        )}
                        {product.isIntermediary && (
                          <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                            Intermediario
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-gray-700">
                    <p>
                      <span className="font-medium">Empresa:</span>{" "}
                      {manufacturerInfo.businessName}
                    </p>
                    {manufacturerInfo.email && (
                      <p>
                        <span className="font-medium">Email:</span>{" "}
                        {manufacturerInfo.email}
                      </p>
                    )}
                    {manufacturerInfo.phone && (
                      <p>
                        <span className="font-medium">Teléfono:</span>{" "}
                        {manufacturerInfo.phone}
                      </p>
                    )}
                    {manufacturerInfo.verified && (
                      <div className="flex items-center gap-2 text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">Fabricante Verificado</span>
                      </div>
                    )}
                    {product.isIntermediary && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        <span className="text-sm font-medium">Intermediario</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COMPRA */}
              {userId && (
                <ProductPurchaseClient
                  price={product.price}
                  MF={minimumOrder}
                  productId={product.id}
                  factoryId={product.factoryId}
                  allowPickup={allowPickup}
                  allowFactoryShipping={allowFactoryShipping}
                  hasFactoryAddress={hasFactoryAddress}
                />
              )}

            </div>
          </div>
        </div>

        {userId && (
          <div className="bg-white rounded-xl shadow-lg p-8 mt-6">
            <ShippingSimulatorSection productId={product.id} />
          </div>
        )}

      </div>
    </div>
  );
}