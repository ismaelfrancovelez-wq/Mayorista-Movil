// app/admin/productos-intermediarios/page.tsx - VERSIÓN CORREGIDA

import { requireAdmin } from "../../../lib/auth/requireAdmin";
import { db } from "../../../lib/firebase-admin";
import AdminProductIntermediaryManager from "../../../components/admin/AdminProductIntermediaryManager";

// Tipo del producto simplificado para esta vista
type AdminProduct = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  factoryId: string;
  isIntermediary: boolean;
  active: boolean;
  createdAt: Date;
};

// 🔧 FUNCIÓN CORREGIDA
async function getAdminProducts(adminUserId: string): Promise<AdminProduct[]> {
  console.log("🔍 Buscando productos para admin:", adminUserId);

  // OPCIÓN 1: Buscar el manufacturer asociado al userId del admin
  const manufacturersSnap = await db
    .collection("manufacturers")
    .where("userId", "==", adminUserId)
    .limit(1)
    .get();

  if (manufacturersSnap.empty) {
    console.log("⚠️ No se encontró manufacturer para userId:", adminUserId);
    console.log("🔍 Intentando buscar productos directamente con factoryId = userId");
    
    // OPCIÓN 2: Si no hay manufacturer, buscar productos donde factoryId = userId
    const productsSnap = await db
      .collection("products")
      .where("factoryId", "==", adminUserId)
      .orderBy("createdAt", "desc")
      .get();

    if (productsSnap.empty) {
      console.log("❌ Tampoco se encontraron productos con factoryId:", adminUserId);
      return [];
    }

    console.log("✅ Encontrados", productsSnap.size, "productos con factoryId = userId");

    return productsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Sin nombre",
        price: data.price || 0,
        minimumOrder: data.minimumOrder || 0,
        factoryId: data.factoryId,
        isIntermediary: data.isIntermediary || false,
        active: data.active !== false,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });
  }

  const factoryId = manufacturersSnap.docs[0].id;
  console.log("✅ Encontrado manufacturer con ID:", factoryId);

  // Obtener todos los productos de este fabricante
  const productsSnap = await db
    .collection("products")
    .where("factoryId", "==", factoryId)
    .orderBy("createdAt", "desc")
    .get();

  console.log("✅ Encontrados", productsSnap.size, "productos para factoryId:", factoryId);

  return productsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "Sin nombre",
      price: data.price || 0,
      minimumOrder: data.minimumOrder || 0,
      factoryId: data.factoryId,
      isIntermediary: data.isIntermediary || false,
      active: data.active !== false,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  });
}

export default async function AdminProductIntermediaryPage() {
  const adminUserId = await requireAdmin();

  const products = await getAdminProducts(adminUserId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        
        {/* HEADER */}
        <div className="mb-8">
          <a 
            href="/admin/verificaciones"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            ← Volver al panel admin
          </a>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gestión de Productos Intermediarios
          </h1>
          <p className="text-gray-600">
            Marca los productos que funcionan como intermediarios (ustedes gestionan stock, compra y logística)
          </p>

          {/* ✅ FIX ERROR 15: Bloque de debug eliminado.
              Antes mostraba adminUserId en el HTML visible → cualquiera que
              abriera DevTools podía ver el ID interno del administrador.
              El console.log en getAdminProducts() es suficiente para debug. */}
        </div>

        {/* INFORMACIÓN */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">
            ℹ️ ¿Qué es un producto intermediario?
          </h3>
          <p className="text-sm text-blue-800">
            Los productos marcados como "intermediarios" mostrarán un badge especial indicando que ustedes (la plataforma) 
            funcionan como intermediarios: consultan precios, gestionan stock, realizan la compra y coordinan la logística. 
            Esto es útil cuando el fabricante original no publica directamente en la plataforma.
          </p>
        </div>

        {/* TABLA DE PRODUCTOS */}
        {products.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">
              No se encontraron productos para tu cuenta
            </p>
            <p className="text-sm text-gray-400">
              Asegúrate de haber creado productos con tu cuenta de admin
            </p>
          </div>
        ) : (
          <AdminProductIntermediaryManager products={products} />
        )}
      </div>
    </div>
  );
}