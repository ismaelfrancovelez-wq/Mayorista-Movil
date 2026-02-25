// app/explorar/cerrando/page.tsx
//
// Página dedicada: /explorar/cerrando
// Muestra todos los lotes que están al 80% o más de su mínimo.
// Todos los niveles pueden VER la página.
// Nadie puede reservar directamente desde acá — se redirige al
// producto individual donde el reserve-route aplica las reglas de nivel.

import Link from "next/link";
import { db } from "../../../lib/firebase-admin";

export const revalidate = 10;

type ClosingSoonLot = {
  lotId: string;
  productId: string;
  productName: string;
  productPrice: number;
  minimumOrder: number;
  accumulatedQty: number;
  percentage: number;
  lotType: string;
  imageUrls?: string[];
  manufacturerName?: string;
  manufacturerImageUrl?: string;
  manufacturerVerified?: boolean;
};

async function getClosingSoonLots(): Promise<ClosingSoonLot[]> {
  try {
    const snap = await db
      .collection("lots")
      .where("status", "==", "accumulating")
      .get();

    if (snap.empty) return [];

    const closingDocs = snap.docs.filter((doc) => {
      const d = doc.data();
      const accumulated = d.accumulatedQty || 0;
      const minimum = d.minimumOrder || 0;
      if (minimum <= 0) return false;
      return accumulated / minimum >= 0.8;
    });

    if (closingDocs.length === 0) return [];

    const productIds = [
      ...new Set(closingDocs.map((d) => d.data().productId).filter(Boolean)),
    ] as string[];

    const productMap: Record<string, {
      name: string; price: number; minimumOrder: number;
      imageUrls?: string[]; factoryId?: string;
    }> = {};

    for (let i = 0; i < productIds.length; i += 10) {
      const chunk = productIds.slice(i, i + 10);
      const pSnap = await db.collection("products").where("__name__", "in", chunk).get();
      pSnap.docs.forEach((doc) => {
        const d = doc.data();
        productMap[doc.id] = {
          name: d.name || "Producto",
          price: d.price || 0,
          minimumOrder: d.minimumOrder || 0,
          imageUrls: Array.isArray(d.imageUrls) ? d.imageUrls : undefined,
          factoryId: d.factoryId || undefined,
        };
      });
    }

    const factoryIds = [
      ...new Set(Object.values(productMap).map((p) => p.factoryId).filter(Boolean)),
    ] as string[];

    const manufacturerMap: Record<string, {
      businessName?: string; profileImageUrl?: string; verified?: boolean;
    }> = {};

    for (let i = 0; i < factoryIds.length; i += 10) {
      const chunk = factoryIds.slice(i, i + 10);
      const mSnap = await db.collection("manufacturers").where("__name__", "in", chunk).get();
      mSnap.docs.forEach((doc) => {
        const d = doc.data();
        manufacturerMap[doc.id] = {
          businessName: d.businessName || "",
          profileImageUrl: d.profileImageUrl || "",
          verified: d.verification?.status === "verified",
        };
      });
    }

    const lots: ClosingSoonLot[] = closingDocs
      .map((doc) => {
        const d = doc.data();
        const product = productMap[d.productId];
        if (!product) return null;
        const accumulated = d.accumulatedQty || 0;
        const minimum = product.minimumOrder || d.minimumOrder || 0;
        const progress = minimum > 0 ? accumulated / minimum : 0;
        const manufacturer = product.factoryId ? manufacturerMap[product.factoryId] : null;
        return {
          lotId: doc.id,
          productId: d.productId,
          productName: product.name,
          productPrice: product.price,
          minimumOrder: minimum,
          accumulatedQty: accumulated,
          percentage: Math.min(Math.round(progress * 100), 100),
          lotType: d.type || "fraccionado",
          imageUrls: product.imageUrls,
          manufacturerName: manufacturer?.businessName || undefined,
          manufacturerImageUrl: manufacturer?.profileImageUrl || undefined,
          manufacturerVerified: manufacturer?.verified || false,
        } as ClosingSoonLot;
      })
      .filter(Boolean) as ClosingSoonLot[];

    return lots.sort((a, b) => b.percentage - a.percentage);
  } catch (error) {
    console.error("Error obteniendo lotes por cerrar:", error);
    return [];
  }
}

export default async function CerrandoPage() {
  const lots = await getClosingSoonLots();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-blue-600 transition">Inicio</Link>
          <span>›</span>
          <Link href="/explorar" className="hover:text-blue-600 transition">Explorar</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">Lotes a punto de cerrar</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔥</span>
            <h1 className="text-3xl font-bold text-gray-900">
              Lotes a punto de cerrar
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl">
            Estos lotes ya alcanzaron el 80% o más de su mínimo. 
            Están a punto de cerrar — quedan muy pocos lugares disponibles.
          </p>

          {/* Aviso de restricción por nivel */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Acceso restringido por nivel
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Estos lotes solo pueden ser reservados por compradores de <strong>Nivel 1 y 2</strong>. 
                Si sos Nivel 3 o 4, mejorá tu historial de pagos para acceder.
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        {lots.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-16 text-center">
            <span className="text-6xl block mb-4">✅</span>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Todo tranquilo por ahora
            </h2>
            <p className="text-gray-500 mb-6">
              No hay lotes al 80% o más en este momento. Explorá todos los productos disponibles.
            </p>
            <Link
              href="/explorar"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              Ver todos los productos
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {lots.length} lote{lots.length !== 1 ? "s" : ""} a punto de cerrar
            </p>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {lots.map((lot) => (
                <LotCard key={lot.lotId} lot={lot} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function LotCard({ lot }: { lot: ClosingSoonLot }) {
  const urgencyColor =
    lot.percentage >= 95
      ? { bar: "bg-red-500", badge: "bg-red-100 text-red-800", border: "border-red-200" }
      : lot.percentage >= 90
      ? { bar: "bg-orange-500", badge: "bg-orange-100 text-orange-800", border: "border-orange-200" }
      : { bar: "bg-amber-500", badge: "bg-amber-100 text-amber-800", border: "border-amber-200" };

  const remainingUnits = lot.minimumOrder - lot.accumulatedQty;

  return (
    <div className={`bg-white rounded-2xl shadow hover:shadow-lg transition overflow-hidden flex flex-col border-2 ${urgencyColor.border}`}>

      {/* Imagen */}
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {lot.imageUrls && lot.imageUrls.length > 0 ? (
          <img
            src={lot.imageUrls[0]}
            alt={lot.productName}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge urgencia */}
        <div className="absolute top-2 left-2">
          <span className={`inline-block text-xs px-2 py-1 rounded-full font-semibold ${urgencyColor.badge}`}>
            🔥 {lot.percentage}% completado
          </span>
        </div>

        {/* Avatar fabricante */}
        {lot.manufacturerName && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full p-0.5 shadow ${lot.manufacturerVerified ? "bg-blue-500" : "bg-white/80"}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-white">
                {lot.manufacturerImageUrl ? (
                  <img src={lot.manufacturerImageUrl} alt={lot.manufacturerName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                    {lot.manufacturerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            {lot.manufacturerVerified && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-5 flex flex-col flex-grow">

        {lot.manufacturerName && (
          <p className="text-xs text-gray-400 mb-1 truncate">{lot.manufacturerName}</p>
        )}

        <h2 className="text-base font-semibold text-gray-900 mb-3 line-clamp-2">
          {lot.productName}
        </h2>

        {/* Barra de progreso */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{lot.accumulatedQty} / {lot.minimumOrder} unidades</span>
            <span className="font-semibold">{lot.percentage}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${urgencyColor.bar}`}
              style={{ width: `${lot.percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Faltan solo <strong>{remainingUnits} unidad{remainingUnits !== 1 ? "es" : ""}</strong> para cerrar
          </p>
        </div>

        {/* Precio */}
        <p className="text-sm text-gray-700 mb-4">
          <span className="font-medium">Precio:</span>{" "}
          <span className="font-bold text-gray-900">${lot.productPrice.toLocaleString("es-AR")}</span>
          {" "}/ u.
        </p>

        {/* Botón — va al producto, el nivel se valida en reserve-route */}
        <Link
          href={`/explorar/${lot.productId}`}
          className="mt-auto w-full bg-blue-600 text-white text-center py-2.5 rounded-xl hover:bg-blue-700 transition font-semibold text-sm"
        >
          Ver producto →
        </Link>
      </div>
    </div>
  );
}