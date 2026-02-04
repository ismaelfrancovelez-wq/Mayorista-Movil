// components/admin/AdminProductIntermediaryManager.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type Props = {
  products: AdminProduct[];
};

export default function AdminProductIntermediaryManager({ products }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Función para cambiar el estado de intermediario
  async function toggleIntermediary(productId: string, currentValue: boolean) {
    const newValue = !currentValue;
    
    if (!confirm(
      newValue 
        ? "¿Marcar este producto como intermediario?"
        : "¿Remover la marca de intermediario de este producto?"
    )) {
      return;
    }

    setLoading(productId);
    setError(null);

    try {
      const res = await fetch("/api/admin/products/mark-intermediary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          isIntermediary: newValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al actualizar producto");
      }

      // Recargar la página para ver los cambios
      router.refresh();
      
    } catch (err: any) {
      setError(err.message || "Error al actualizar producto");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      
      {/* MENSAJE DE ERROR GLOBAL */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 p-4">
          ❌ {error}
        </div>
      )}

      {/* TABLA */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Producto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mín. Orden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Intermediario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 transition">
                
                {/* NOMBRE */}
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">
                    {product.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {product.createdAt.toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </td>

                {/* PRECIO */}
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-gray-900">
                    ${product.price.toLocaleString('es-AR')}
                  </div>
                </td>

                {/* PEDIDO MÍNIMO */}
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600">
                    {product.minimumOrder} uds
                  </div>
                </td>

                {/* ESTADO ACTIVO */}
                <td className="px-6 py-4">
                  {product.active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Inactivo
                    </span>
                  )}
                </td>

                {/* ESTADO INTERMEDIARIO */}
                <td className="px-6 py-4">
                  {product.isIntermediary ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      <svg 
                        className="w-3 h-3"
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                      </svg>
                      SÍ
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      NO
                    </span>
                  )}
                </td>

                {/* ACCIÓN */}
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleIntermediary(product.id, product.isIntermediary)}
                    disabled={loading === product.id}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      product.isIntermediary
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-orange-600 text-white hover:bg-orange-700"
                    }`}
                  >
                    {loading === product.id ? (
                      "Procesando..."
                    ) : product.isIntermediary ? (
                      "Quitar marca"
                    ) : (
                      "Marcar como intermediario"
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Total de productos: <span className="font-semibold">{products.length}</span>
        </p>
      </div>
    </div>
  );
}