"use client";

import { useEffect, useState } from "react";
import { FeaturedDuration, FEATURED_PRICES } from "../../../../lib/types/featured";
import BackButton from "../../../../components/BackButton"; 

type Product = {
  id: string;
  name: string;
  featured: boolean;
  featuredUntil?: string;
};

type Factory = {
  id: string;
  name: string;
};

export default function DestacadosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [factory, setFactory] = useState<Factory | null>(null);
  const [loading, setLoading] = useState(true);
  // ✅ NUEVO: guardar el rol para mostrar texto correcto
  const [activeRole, setActiveRole] = useState<string>("manufacturer");
  
  const [selectedType, setSelectedType] = useState<"product" | "factory">("product");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<FeaturedDuration>(7);
  
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [error, setError] = useState("");
  
  const [myFeatured, setMyFeatured] = useState<any[]>([]);
  const [loadingMyFeatured, setLoadingMyFeatured] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) throw new Error("No autorizado");
        
        const { userId, activeRole: role } = await meRes.json();
        setFactory({ id: userId, name: "Mi Empresa" });
        // ✅ NUEVO: guardar el rol activo
        if (role) setActiveRole(role);

        const productsRes = await fetch("/api/products/my-products");
        if (!productsRes.ok) throw new Error("Error al cargar productos");
        
        const data = await productsRes.json();
        
        if (data.products && Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setProducts([]);
        }
        
      } catch (err) {
        console.error("❌ Error cargando datos:", err);
        setError("Error al cargar tus productos");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    async function loadMyFeatured() {
      try {
        const res = await fetch("/api/featured/my-featured");
        if (res.ok) {
          const data = await res.json();
          setMyFeatured(data.items || []);
        }
      } catch (err) {
        console.error("Error cargando destacados:", err);
      } finally {
        setLoadingMyFeatured(false);
      }
    }
    loadMyFeatured();
  }, []);

  async function handleCreateFeatured() {
    if (!selectedItemId) {
      setError("Seleccioná un item para destacar");
      return;
    }

    setLoadingPayment(true);
    setError("");

    try {
      const res = await fetch("/api/featured/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          itemId: selectedItemId,
          duration: selectedDuration,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear destacado");
      }

      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingPayment(false);
    }
  }

  // ✅ NUEVO: etiqueta dinámica según el rol
  const businessLabel =
    activeRole === "distributor" ? "Mi Distribuidora" :
    activeRole === "wholesaler" ? "Mi Mayorista" :
    "Mi Fábrica";

  const price = FEATURED_PRICES[selectedDuration];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        
        <BackButton className="mb-6" />

        <h1 className="text-3xl font-semibold mb-2">Destacar en el Home</h1>
        <p className="text-gray-600 mb-8">
          Aumentá la visibilidad de tus productos o empresa en la página principal
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-lg mb-3">📊 Información de espacios disponibles</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• <strong>10 espacios</strong> para productos destacados</li>
            <li>• <strong>10 espacios</strong> para empresas destacadas</li>
            <li>• Los espacios se asignan por orden de llegada</li>
            <li>• Cuando vence tu destacado, se libera el espacio</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-8">
          
          <div className="mb-6">
            <label className="block font-medium mb-3">¿Qué querés destacar?</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { setSelectedType("product"); setSelectedItemId(""); }}
                className={`p-4 rounded-xl border-2 transition ${
                  selectedType === "product" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-3xl mb-2">📦</div>
                <div className="font-semibold">Un Producto</div>
                <div className="text-xs text-gray-500 mt-1">Aparecerá en la sección de productos destacados</div>
              </button>

              <button
                onClick={() => { setSelectedType("factory"); setSelectedItemId(factory?.id || ""); }}
                className={`p-4 rounded-xl border-2 transition ${
                  selectedType === "factory" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-3xl mb-2">🏭</div>
                {/* ✅ CORREGIDO: texto dinámico según el rol */}
                <div className="font-semibold">{businessLabel}</div>
                <div className="text-xs text-gray-500 mt-1">Aparecerá en la sección de empresas destacadas</div>
              </button>
            </div>
          </div>

          {selectedType === "product" && (
            <div className="mb-6">
              <label className="block font-medium mb-2">Seleccioná el producto</label>
              
              {loading ? (
                <div className="text-sm text-gray-500">Cargando productos...</div>
              ) : products.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg text-sm">
                  <p className="font-medium mb-1">No tenés productos creados</p>
                  <p>Primero debés crear al menos un producto en la sección "Productos"</p>
                </div>
              ) : (
                <>
                  <select
                    className="w-full border rounded-lg px-4 py-3"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                  >
                    <option value="">-- Elegí un producto --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.featured && "(ya destacado)"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">Total de productos: {products.length}</p>
                </>
              )}
            </div>
          )}

          <div className="mb-6">
            <label className="block font-medium mb-3">Duración</label>
            <div className="grid grid-cols-3 gap-4">
              {([7, 15, 30] as FeaturedDuration[]).map((days) => (
                <button
                  key={days}
                  onClick={() => setSelectedDuration(days)}
                  className={`p-4 rounded-xl border-2 transition ${
                    selectedDuration === days ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-lg">{days} días</div>
                  <div className="text-sm text-gray-600 mt-1">${FEATURED_PRICES[days].toLocaleString("es-AR")}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="font-semibold mb-3">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <span className="font-medium">
                  {selectedType === "product" ? "Producto" : businessLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duración:</span>
                <span className="font-medium">{selectedDuration} días</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t pt-2 mt-2">
                <span>Total a pagar:</span>
                <span className="text-blue-600">${price.toLocaleString("es-AR")}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateFeatured}
            disabled={loadingPayment || !selectedItemId || (selectedType === "product" && products.length === 0)}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPayment ? "Procesando..." : "Continuar al pago"}
          </button>

        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Mis destacados activos</h2>
          
          {loadingMyFeatured ? (
            <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">Cargando...</div>
          ) : myFeatured.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6">
              <p className="text-gray-500 text-sm">Aquí aparecerán tus productos o empresa cuando estén destacados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myFeatured.map((item) => {
                const endDate = new Date(item.endDate);
                const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={item.id} className={`bg-white rounded-xl shadow p-6 flex items-center justify-between gap-4 border-l-4 ${item.active ? "border-green-500" : "border-gray-300"}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{item.type === "factory" ? "🏭" : "📦"}</span>
                        <span className="font-semibold text-gray-900">{item.metadata?.name || item.itemId}</span>
                        {item.active ? (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">Activo</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">Vencido</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {item.type === "factory" ? businessLabel : "Producto"} destacado
                      </p>
                    </div>
                    <div className="text-right">
                      {item.active ? (
                        <>
                          <p className="text-2xl font-bold text-gray-900">{daysLeft}</p>
                          <p className="text-xs text-gray-500">días restantes</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Venció el {endDate.toLocaleDateString("es-AR")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}