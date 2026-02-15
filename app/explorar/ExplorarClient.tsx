// app/explorar/ExplorarClient.tsx - DISEÑO ORIGINAL
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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

export default function ExplorarClient({ initialProducts }: { initialProducts: Product[] }) {
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts);

  // 🔍 Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxOrder, setMaxOrder] = useState("");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  // 🔄 Aplicar filtros
  useEffect(() => {
    let result = [...initialProducts];

    // 🔍 Búsqueda por nombre
    if (searchTerm) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 📂 Filtro de categoría
    if (selectedCategory !== "all") {
      result = result.filter(p => p.category === selectedCategory);
    }

    // 💰 Filtro de precio
    if (minPrice) {
      result = result.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      result = result.filter(p => p.price <= Number(maxPrice));
    }

    // 📦 Filtro de pedido mínimo
    if (minOrder) {
      result = result.filter(p => p.minimumOrder >= Number(minOrder));
    }
    if (maxOrder) {
      result = result.filter(p => p.minimumOrder <= Number(maxOrder));
    }

    // ⭐ Solo destacados
    if (onlyFeatured) {
      result = result.filter(p => p.featured);
    }

    // 🔢 Ordenamiento
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

    setFilteredProducts(result);
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

  // 🧹 Limpiar filtros
  function clearFilters() {
    setSearchTerm("");
    setSelectedCategory("all");
    setMinPrice("");
    setMaxPrice("");
    setMinOrder("");
    setMaxOrder("");
    setOnlyFeatured(false);
    setSortBy("name");
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
            Comprá directo o participá en pedidos fraccionados
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
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                  onChange={(e) => setSelectedCategory(e.target.value as ProductCategory | "all")}
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
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Máx"
                    className="border rounded px-3 py-2 text-sm"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
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
                    onChange={(e) => setMinOrder(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Máx"
                    className="border rounded px-3 py-2 text-sm"
                    value={maxOrder}
                    onChange={(e) => setMaxOrder(e.target.value)}
                  />
                </div>
              </div>

              {/* Solo destacados */}
              <div className="mb-5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyFeatured}
                    onChange={(e) => setOnlyFeatured(e.target.checked)}
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
              {filteredProducts.length} producto{filteredProducts.length !== 1 && 's'} encontrado{filteredProducts.length !== 1 && 's'}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-12 text-center">
                <p className="text-gray-500 text-lg">
                  No se encontraron productos con estos filtros
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden flex flex-col"
                  >
                    {/* IMAGEN DEL PRODUCTO */}
                    <div className="relative h-48 bg-gray-200 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
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
                      
                      {/* Badge destacado sobre la imagen */}
                      {product.featured && (
                        <div className="absolute top-2 left-2">
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                            ⭐ Destacado
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CONTENIDO DEL CARD */}
                    <div className="p-6 flex flex-col flex-grow">
                      {/* Nombre */}
                      <h2 className="text-lg font-semibold mb-2 line-clamp-2">
                        {product.name}
                      </h2>

                      {/* Categoría */}
                      <p className="text-xs text-gray-500 mb-3">
                        {CATEGORY_LABELS[product.category]}
                      </p>

                      {/* Precio */}
                      <p className="text-gray-900 mb-1">
                        <span className="font-medium">Precio:</span>{" "}
                        <span className="font-bold text-blue-600">
                          ${product.price.toLocaleString("es-AR")}
                        </span>
                      </p>

                      {/* Pedido mínimo */}
                      <p className="text-sm text-gray-600 mb-4">
                        Pedido mínimo: {product.minimumOrder} unidades
                      </p>

                      {/* Botón */}
                      <Link
                        href={`/explorar/${product.id}`}
                        className="mt-auto w-full bg-blue-600 text-white text-center py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                      >
                        Ver producto →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}