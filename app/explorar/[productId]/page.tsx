// app/explorar/[productId]/page.tsx - DISEÑO ORIGINAL + OPTIMIZADO

import { headers } from "next/headers";
import { cookies } from "next/headers";
import { db } from "../../../lib/firebase-admin";
import type { Product } from "../../../lib/types/product";
import ProductPurchaseClient from "../../../components/products/ProductPurchaseClient";
import ManufacturerInfoCard from "../../../components/ManufacturerInfoCard.tsx";
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        
        <Link
          href="/explorar"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6"
        >
          ← Volver a explorar
        </Link>

        {/* LAYOUT DE 2 COLUMNAS CON IMAGEN */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid lg:grid-cols-2 gap-0">
            
            {/* COLUMNA IZQUIERDA - IMAGEN */}
            <div className="relative bg-gray-100">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  style={{ minHeight: "400px", maxHeight: "600px" }}
                />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200" 
                  style={{ minHeight: "400px" }}
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

            {/* COLUMNA DERECHA - INFO PRODUCTO */}
            <div className="p-8 flex flex-col">
              
              {/* HEADER */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
                <p className="text-4xl text-blue-600 font-bold">
                  ${product.price.toLocaleString("es-AR")}
                </p>
              </div>

              {/* PEDIDO MÍNIMO */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Pedido mínimo</p>
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
                      <div className="flex items-center gap-2 text-purple-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                        <span className="text-sm font-medium">Gestionado por plataforma</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COMPRA */}
              {userId && (
                <div className="mt-auto">
                  <ProductPurchaseClient
                    price={product.price}
                    MF={minimumOrder}
                    productId={product.id}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}