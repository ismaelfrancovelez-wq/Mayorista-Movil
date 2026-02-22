"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "../../../../components/BackButton";

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  category: string;
  featured: boolean;
  active: boolean;
  imageUrls?: string[];
};

export default function ProductosFabricantePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const res = await fetch("/api/products/my-products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Error cargando productos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productId: string, productName: string) {
    if (!confirm(`¿Estás seguro que querés eliminar "${productName}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingId(productId);

    try {
      const res = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar producto");
      }

      await loadProducts();
      alert("Producto eliminado correctamente");
    } catch (error: any) {
      alert(error.message || "Error al eliminar producto");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <p className="text-gray-600">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      
      <BackButton className="mb-4" />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Mis productos</h1>
        
        <Link
          href="/dashboard/fabricante/productos/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          ➕ Añadir producto
        </Link>
      </div>

      {products.length === 0 && (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <p className="text-gray-500 mb-4">Todavía no publicaste productos.</p>
          <Link
            href="/dashboard/fabricante/productos/nuevo"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Crear primer producto
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
          >
            {/* IMAGEN DEL PRODUCTO */}
            <div className="relative h-48 bg-gray-200">
              {p.imageUrls && p.imageUrls.length > 0 ? (
                <img
                  src={p.imageUrls[0]}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <svg
                    className="w-16 h-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
              
              {/* Badge destacado */}
              {p.featured && (
                <span className="absolute top-4 right-4 inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                  ⭐ Destacado
                </span>
              )}
            </div>

            {/* CONTENIDO DEL CARD */}
            <div className="p-6">
              <h3 className="font-semibold text-lg mb-3">{p.name}</h3>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Precio:</span> ${p.price.toLocaleString('es-AR')}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Mínimo:</span> {p.minimumOrder} unidades
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Categoría:</span> {p.category}
                </p>
              </div>

              {/* ✅ BOTONES: Editar + Eliminar */}
              <div className="flex flex-col gap-2">
                <Link
                  href={`/dashboard/fabricante/productos/${p.id}/editar`}
                  className="w-full border-2 border-blue-500 text-blue-600 py-2 rounded-lg hover:bg-blue-50 transition font-medium text-center"
                >
                  ✏️ Editar producto
                </Link>

                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  disabled={deletingId === p.id}
                  className="w-full border-2 border-red-500 text-red-600 py-2 rounded-lg hover:bg-red-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === p.id ? "Eliminando..." : "🗑️ Eliminar producto"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}