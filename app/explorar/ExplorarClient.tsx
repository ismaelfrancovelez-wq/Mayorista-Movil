// app/explorar/ExplorarClient.tsx
"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { ProductCategory, CATEGORY_LABELS } from "../../lib/types/product";

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  category: ProductCategory;
  featured: boolean;
  shippingMethods: string[];
  imageUrl?: string;
};

type SortOption = "price_asc" | "price_desc" | "min_asc" | "min_desc" | "name";

const ITEMS_PER_PAGE = 20;

export default function ExplorarClient({ initialProducts }: { initialProducts: Product[] }) {
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxOrder, setMaxOrder] = useState("");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  // Estado de paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Aplicar filtros y ordenamiento
  const filteredProducts = useMemo(() => {
    let result = [...initialProducts];

    // Búsqueda
    if (searchTerm) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Categoría
    if (selectedCategory !== "all") {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Precio
    if (minPrice) {
      result = result.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      result = result.filter(p => p.price <= Number(maxPrice));
    }

    // Pedido mínimo
    if (minOrder) {
      result = result.filter(p => p.minimumOrder >= Number(minOrder));
    }
    if (maxOrder) {
      result = result.filter(p => p.minimumOrder <= Number(maxOrder));
    }

    // Destacados
    if (onlyFeatured) {
      result = result.filter(p => p.featured);
    }

    // Ordenamiento
    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "min_asc":
        result.sort((a, b) => a.minimumOrder - b.minimumOrder);
        break;
      case "min_desc":
        result.sort((a, b) => b.minimumOrder - a.minimumOrder);
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [
    initialProducts,
    searchTerm,
    selectedCategory,
    minPrice,
    maxPrice,
    minOrder,
    maxOrder,
    onlyFeatured,
    sortBy,
  ]);

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Resetear página al cambiar filtros
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Limpiar filtros
  function clearFilters() {
    setSearchTerm("");
    setSelectedCategory("all");
    setMinPrice("");
    setMaxPrice("");
    setMinOrder("");
    setMaxOrder("");
    setOnlyFeatured(false);
    setSortBy("name");
    setCurrentPage(1);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Botón Volver */}
        <button
          onClick={() => window.history.back()}
          className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2 font-medium"
        >
          ← Volver
        </button>

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            Explorar productos
          </h1>
          <p className="text-gray-600">
            {filteredProducts.length} productos disponibles
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          
          {/* SIDEBAR DE FILTROS */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6 sticky top-6">
              
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg">Filtros</h2>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Limpiar
                </button>
              </div>

              {/* Búsqueda */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">
                  Buscar
                </label>
                <input
                  type="text"
                  placeholder="Nombre del producto..."
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    handleFilterChange();
                  }}
                />
              </div>

              {/* Categoría */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">
                  Categoría
                </label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value as ProductCategory | "all");
                    handleFilterChange();
                  }}
                >
                  <option value="all">Todas las categorías</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rango de precio */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">
                  Precio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Mín"
                    className="border rounded px-3 py-2 text-sm"
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value);
                      handleFilterChange();
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Máx"
                    className="border rounded px-3 py-2 text-sm"
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value);
                      handleFilterChange();
                    }}
                  />
                </div>
              </div>

              {/* Pedido mínimo */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">
                  Pedido mínimo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Mín"
                    className="border rounded px-3 py-2 text-sm"
                    value={minOrder}
                    onChange={(e) => {
                      setMinOrder(e.target.value);
                      handleFilterChange();
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Máx"
                    className="border rounded px-3 py-2 text-sm"
                    value={maxOrder}
                    onChange={(e) => {
                      setMaxOrder(e.target.value);
                      handleFilterChange();
                    }}
                  />
                </div>
              </div>

              {/* Solo destacados */}
              <div className="mb-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyFeatured}
                    onChange={(e) => {
                      setOnlyFeatured(e.target.checked);
                      handleFilterChange();
                    }}
                  />
                  <span className="text-sm">Solo destacados</span>
                </label>
              </div>

              {/* Ordenar */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ordenar por
                </label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="name">Nombre A-Z</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                  <option value="min_asc">Pedido mín: menor a mayor</option>
                  <option value="min_desc">Pedido mín: mayor a menor</option>
                </select>
              </div>

            </div>
          </aside>

          {/* LISTA DE PRODUCTOS */}
          <div className="lg:col-span-3">
            
            {/* Contador de resultados */}
            <div className="mb-4 text-sm text-gray-600">
              Mostrando {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} de {filteredProducts.length} productos
            </div>

            {currentProducts.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <p className="text-gray-500 text-lg mb-2">
                  No se encontraron productos
                </p>
                <p className="text-gray-400 mb-4">
                  Intentá ajustar los filtros
                </p>
                <button
                  onClick={clearFilters}
                  className="text-blue-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <>
                {/* Grid de productos */}
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                  {currentProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/explorar/${product.id}`}
                      className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden group"
                    >
                      {/* Imagen */}
                      {product.imageUrl ? (
                        <div className="aspect-square overflow-hidden bg-gray-100">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <svg
                            className="w-16 h-16 text-gray-400"
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

                      {/* Info */}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-2xl font-bold text-blue-600 mb-2">
                          ${product.price.toLocaleString("es-AR")}
                        </p>
                        <p className="text-sm text-gray-600">
                          Mínimo: {product.minimumOrder} unidades
                        </p>
                        {product.featured && (
                          <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                            ⭐ Destacado
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    
                    <div className="flex gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Mostrar solo páginas cercanas
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 2 && page <= currentPage + 2)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-4 py-2 border rounded-lg ${
                                page === currentPage
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === currentPage - 3 ||
                          page === currentPage + 3
                        ) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}