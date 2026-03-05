"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ProductCategory, CATEGORY_LABELS, SellerType, SELLER_TYPE_LABELS, SELLER_TYPE_COLORS } from "../../lib/types/product";

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  category: ProductCategory;
  featured: boolean;
  shippingMethods: string[];
  imageUrls?: string[];
  // Datos del vendedor
  manufacturerName?: string;
  manufacturerImageUrl?: string;
  manufacturerVerified?: boolean;
  isIntermediary?: boolean;
  unitLabel?: string;
  // ✅ NUEVO: tipo de vendedor
  sellerType?: SellerType;
  // ✅ NUEVO: variantes de medida/precio
  variants?: { unitLabel: string; price: number; minimumOrder: number }[];
};

// ✅ NUEVO: tipo para lotes por cerrar
type ClosingSoonLot = {
  lotId: string;
  productId: string;
  productName: string;
  productPrice: number;
  minimumOrder: number;
  accumulatedQty: number;
  percentage: number;
  imageUrls?: string[];
  manufacturerName?: string;
  manufacturerVerified?: boolean;
  manufacturerImageUrl?: string;
  unitLabel?: string;
};

type SortOption = "price_asc" | "price_desc" | "min_asc" | "min_desc" | "name";

export default function ExplorarClient({ initialProducts }: { initialProducts: Product[] }) {
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts);

  // ✅ Estado de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialProducts.length === 20);
  const [loadingMore, setLoadingMore] = useState(false);

  // ✅ Estado de lotes por cerrar
  const [closingSoon, setClosingSoon] = useState<ClosingSoonLot[]>([]);
  const [loadingClosing, setLoadingClosing] = useState(true);

  // 🔍 Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxOrder, setMaxOrder] = useState("");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  // ✅ Cargar lotes por cerrar al montar
  useEffect(() => {
    async function fetchClosingSoon() {
      try {
        const res = await fetch("/api/lots/closing-soon");
        if (!res.ok) return;
        const data = await res.json();
        setClosingSoon(data.lots || []);
      } catch (err) {
        console.error("Error cargando lotes por cerrar:", err);
      } finally {
        setLoadingClosing(false);
      }
    }
    fetchClosingSoon();
  }, []);

  // 🔄 Aplicar filtros sobre TODOS los productos cargados
  useEffect(() => {
    let result = [...allProducts];

    if (searchTerm) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (minPrice) {
      result = result.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      result = result.filter(p => p.price <= Number(maxPrice));
    }

    if (minOrder) {
      result = result.filter(p => p.minimumOrder >= Number(minOrder));
    }
    if (maxOrder) {
      result = result.filter(p => p.minimumOrder <= Number(maxOrder));
    }

    if (onlyFeatured) {
      result = result.filter(p => p.featured);
    }

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
    allProducts,
    searchTerm,
    selectedCategory,
    minPrice,
    maxPrice,
    minOrder,
    maxOrder,
    onlyFeatured,
    sortBy,
  ]);

  // ✅ Función para cargar la siguiente página
  async function loadMore() {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const res = await fetch(`/api/products/explore?page=${nextPage}`);
      if (!res.ok) throw new Error("Error al cargar más productos");

      const data = await res.json();
      const newProducts: Product[] = data.products || [];

      setAllProducts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const unique = newProducts.filter(p => !existingIds.has(p.id));
        return [...prev, ...unique];
      });

      setCurrentPage(nextPage);
      setHasMore(data.hasMore === true);
    } catch (err) {
      console.error("Error cargando más productos:", err);
    } finally {
      setLoadingMore(false);
    }
  }

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

  // ✅ NUEVO: helper para obtener la etiqueta y color del tipo de vendedor
  function getSellerBadge(sellerType?: SellerType) {
    if (!sellerType) return null;
    const label = SELLER_TYPE_LABELS[sellerType];
    const colors = SELLER_TYPE_COLORS[sellerType];
    return { label, colors };
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

        {/* SECCIÓN LOTES A PUNTO DE CERRAR */}
        {(true) && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <h2 className="text-xl font-bold text-gray-900">
                  Lotes a punto de cerrar
                </h2>
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  ≥ 80% completado
                </span>
              </div>
              <Link
                href="/explorar/cerrando"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                Ver todos →
              </Link>
            </div>

            {loadingClosing ? (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="min-w-[260px] h-64 bg-gray-200 rounded-2xl animate-pulse flex-shrink-0" />
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                {closingSoon.slice(0, 8).map((lot) => {
                  const urgencyColor =
                    lot.percentage >= 95 ? "bg-red-500"
                    : lot.percentage >= 90 ? "bg-orange-500"
                    : "bg-amber-500";
                  const badgeColor =
                    lot.percentage >= 95 ? "bg-red-100 text-red-800"
                    : lot.percentage >= 90 ? "bg-orange-100 text-orange-800"
                    : "bg-amber-100 text-amber-800";
                  const remainingUnits = lot.minimumOrder - lot.accumulatedQty;

                  return (
                    <Link
                      key={lot.lotId}
                      href={`/explorar/${lot.productId}`}
                      className="min-w-[260px] max-w-[260px] flex-shrink-0 snap-start bg-white rounded-2xl shadow hover:shadow-lg transition overflow-hidden flex flex-col border border-gray-100 hover:border-blue-200"
                    >
                      {/* Imagen */}
                      <div className="relative h-36 bg-gray-100 overflow-hidden">
                        {lot.imageUrls && lot.imageUrls.length > 0 ? (
                          <img
                            src={lot.imageUrls[0]}
                            alt={lot.productName}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}>
                            🔥 {lot.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 flex flex-col flex-grow">
                        {lot.manufacturerName && (
                          <p className="text-xs text-gray-400 mb-1 truncate">{lot.manufacturerName}</p>
                        )}
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">
                          {lot.productName}
                        </p>

                        {/* Barra de progreso */}
                        <div className="mb-2">
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${urgencyColor}`}
                              style={{ width: `${lot.percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Faltan <strong>{remainingUnits}</strong> u. para cerrar
                          </p>
                        </div>

                        <p className="text-xs font-bold text-gray-900 mt-auto">
                          ${lot.productPrice.toLocaleString("es-AR")}{lot.unitLabel ? ` / ${lot.unitLabel}` : " / u."}
                        </p>
                      </div>
                    </Link>
                  );
                })}

                {/* Card "Ver todos" al final del scroll */}
                <Link
                  href="/explorar/cerrando"
                  className="min-w-[140px] flex-shrink-0 snap-start bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-blue-600 hover:bg-blue-100 transition p-6 text-center"
                >
                  <span className="text-3xl">→</span>
                  <span className="text-sm font-semibold">Ver todos</span>
                </Link>
              </div>
            )}
          </div>
        )}

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
                <label className="block text-sm font-medium mb-2">Buscar</label>
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
                <label className="block text-sm font-medium mb-2">Categoría</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as ProductCategory | "all")}
                >
                  <option value="all">Todas las categorías</option>
                  {/* ✅ CORREGIDO: tipado como [string, string][] para evitar error "unknown" */}
                  {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rango de precio */}
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">Precio</label>
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
                <label className="block text-sm font-medium mb-2">Pedido mínimo</label>
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
                <label className="block text-sm font-medium mb-2">Ordenar por</label>
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
              {filteredProducts.length} producto{filteredProducts.length !== 1 && "s"} encontrado{filteredProducts.length !== 1 && "s"}
              {hasMore && " (hay más por cargar)"}
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
              <>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => {
                    // ✅ NUEVO: obtener etiqueta del tipo de vendedor
                    const sellerBadge = getSellerBadge(product.sellerType);

                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden flex flex-col"
                      >
                        {/* IMAGEN DEL PRODUCTO */}
                        <div className="relative h-48 bg-gray-200 overflow-hidden">
                          {product.imageUrls && product.imageUrls.length > 0 ? (
                            <img
                              src={product.imageUrls[0]}
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

                          {/* Badge destacado */}
                          {product.featured && (
                            <div className="absolute top-2 left-2">
                              <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                                ⭐ Destacado
                              </span>
                            </div>
                          )}

                          {/* AVATAR DEL VENDEDOR - esquina inferior izquierda */}
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                            <div className="relative">
                              <div className={`w-9 h-9 rounded-full p-0.5 shadow ${product.manufacturerVerified ? "bg-blue-500" : "bg-white/80"}`}>
                                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                                  {product.manufacturerImageUrl ? (
                                    <img
                                      src={product.manufacturerImageUrl}
                                      alt={product.manufacturerName || "Vendedor"}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                      {product.manufacturerName
                                        ? product.manufacturerName.charAt(0).toUpperCase()
                                        : "V"}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Check verificado */}
                              {product.manufacturerVerified && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Badge intermediario */}
                            {product.isIntermediary && (
                              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow">
                                Intermediario
                              </span>
                            )}
                          </div>
                        </div>

                        {/* CONTENIDO DEL CARD */}
                        <div className="p-6 flex flex-col flex-grow">

                          {/* ✅ NUEVO: Nombre del vendedor + etiqueta de tipo */}
                          <div className="flex items-center gap-2 mb-2">
                            {product.manufacturerName && (
                              <p className="text-xs text-gray-400 truncate">
                                {product.manufacturerName}
                              </p>
                            )}
                            {/* ✅ Etiqueta "Fabricante", "Distribuidor" o "Mayorista" */}
                            {sellerBadge && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${sellerBadge.colors}`}>
                                {sellerBadge.label}
                              </span>
                            )}
                          </div>

                          {/* Nombre del producto */}
                          <h2 className="text-lg font-semibold mb-2 line-clamp-2">
                            {product.name}
                          </h2>

                          {/* Categoría */}
                          <p className="text-xs text-gray-500 mb-3">
                            {CATEGORY_LABELS[product.category]}
                          </p>

                          {/* Precio — muestra presentación base + todas las variantes en la misma línea */}
                          <div className="mb-3">
                            <span className="font-medium text-gray-900">Precio: </span>
                            <span className="font-bold text-gray-900">
                              ${product.price.toLocaleString("es-AR")}
                              {product.unitLabel && (
                                <span className="text-gray-500 font-normal text-sm"> / {product.unitLabel}</span>
                              )}
                            </span>
                            {/* ✅ Variantes inline junto al precio base */}
                            {product.variants && product.variants.length > 0 && product.variants.map((v, i) => (
                              <span key={i} className="text-gray-500 text-sm">
                                {"  "}·{"  "}
                                <span className="font-semibold text-gray-800">${v.price.toLocaleString("es-AR")}</span>
                                <span className="text-gray-400"> / {v.unitLabel}</span>
                              </span>
                            ))}
                          </div>

                          {/* Pedido mínimo */}
                          <p className="text-sm text-gray-600 mb-3">
                            Pedido mínimo: {product.minimumOrder}{" "}
                            {product.unitLabel
                              ? `unidades (${product.unitLabel} c/u)`
                              : "unidades"}
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
                    );
                  })}
                </div>

                {/* BOTÓN CARGAR MÁS */}
                {hasMore && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-8 py-3 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2 justify-center">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Cargando...
                        </span>
                      ) : (
                        "Cargar más productos"
                      )}
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