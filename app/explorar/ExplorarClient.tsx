"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { ProductCategory, CATEGORY_LABELS, SellerType, SELLER_TYPE_LABELS, SELLER_TYPE_COLORS } from "../../lib/types/product";
import UserRoleHeader from "../../components/UserRoleHeader";
import OnboardingChecklist from "../../components/OnboardingChecklist";

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  category: ProductCategory;
  featured: boolean;
  shippingMethods: string[];
  imageUrls?: string[];
  manufacturerName?: string;
  manufacturerImageUrl?: string;
  manufacturerVerified?: boolean;
  isIntermediary?: boolean;
  unitLabel?: string;
  sellerType?: SellerType;
  variants?: { unitLabel: string; price: number; minimumOrder: number }[];
  stock?: number | null;
  accumulatedQty?: number;
};

type ProductIndex = { id: string; name: string };

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

type SortOption = "activity" | "price_asc" | "price_desc" | "min_asc" | "min_desc" | "name";

type RetailerPanelData = {
  userId: string;
  userEmail: string;
  userName: string;
  activeRole: string;
  hasAddress: boolean;
  hasOrders: boolean;
  milestoneBadges: string[];
  streakBadges: string[];
  currentStreak: number;
  paymentLevel: number;
  completedLots: number;
  scoreValue: number;
};

export default function ExplorarClient({
  initialProducts,
  retailerPanel,
}: {
  initialProducts: Product[];
  retailerPanel: RetailerPanelData | null;
}) {
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(initialProducts);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialProducts.length === 20);
  const [loadingMore, setLoadingMore] = useState(false);

  const [productIndex, setProductIndex] = useState<ProductIndex[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [closingSoon, setClosingSoon] = useState<ClosingSoonLot[]>([]);
  const [loadingClosing, setLoadingClosing] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxOrder, setMaxOrder] = useState("");
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // leer searchParams del URL al montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search");
    const category = params.get("category");
    if (search) setSearchTerm(search);
    if (category) setSelectedCategory(category as ProductCategory);
  }, []);

  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch("/api/products/search-index");
        if (!res.ok) return;
        const data = await res.json();
        setProductIndex(data.index || []);
        setIndexLoaded(true);
      } catch (err) {
        console.error("Error cargando índice de búsqueda:", err);
      }
    }
    loadIndex();
  }, []);

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

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (searchTerm.trim() === "") {
      setAllProducts(initialProducts);
      setHasMore(initialProducts.length === 20);
      setCurrentPage(1);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const term = searchTerm.trim().toLowerCase();

        if (indexLoaded && productIndex.length > 0) {
          const matchingIds = productIndex
            .filter((p) => p.name.toLowerCase().includes(term))
            .map((p) => p.id)
            .slice(0, 100);

          if (matchingIds.length === 0) {
            setAllProducts([]);
            setHasMore(false);
            setCurrentPage(1);
            return;
          }

          const res = await fetch(`/api/products/explore?ids=${matchingIds.join(",")}`);
          if (!res.ok) throw new Error("Error al buscar");
          const data = await res.json();
          setAllProducts(data.products || []);
          setHasMore(false);
          setCurrentPage(1);
        } else {
          const res = await fetch(`/api/products/explore?search=${encodeURIComponent(term)}`);
          if (!res.ok) throw new Error("Error al buscar");
          const data = await res.json();
          setAllProducts(data.products || []);
          setHasMore(false);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Error buscando productos:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm, initialProducts, productIndex, indexLoaded]);

  useEffect(() => {
    let result = [...allProducts];

    if (selectedCategory !== "all") result = result.filter(p => p.category === selectedCategory);
    if (minPrice) result = result.filter(p => p.price >= Number(minPrice));
    if (maxPrice) result = result.filter(p => p.price <= Number(maxPrice));
    if (minOrder) result = result.filter(p => p.minimumOrder >= Number(minOrder));
    if (maxOrder) result = result.filter(p => p.minimumOrder <= Number(maxOrder));
    if (onlyFeatured) result = result.filter(p => p.featured);

    switch (sortBy) {
      case "activity": result.sort((a, b) => (b.accumulatedQty || 0) - (a.accumulatedQty || 0)); break;
      case "price_asc": result.sort((a, b) => a.price - b.price); break;
      case "price_desc": result.sort((a, b) => b.price - a.price); break;
      case "min_asc": result.sort((a, b) => a.minimumOrder - b.minimumOrder); break;
      case "min_desc": result.sort((a, b) => b.minimumOrder - a.minimumOrder); break;
      case "name": break;
    }

    setFilteredProducts(result);
  }, [allProducts, selectedCategory, minPrice, maxPrice, minOrder, maxOrder, onlyFeatured, sortBy]);

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

  function getSellerBadge(sellerType?: SellerType) {
    if (!sellerType) return null;
    return { label: SELLER_TYPE_LABELS[sellerType], colors: SELLER_TYPE_COLORS[sellerType] };
  }

  function isOutOfStock(product: Product): boolean {
    return product.stock !== null && product.stock !== undefined && product.stock === 0;
  }

  const displayName = retailerPanel?.userName || retailerPanel?.userEmail?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ══════════════════════════════════════════════════════════════════
          BARRA DE PANEL — solo visible para revendedores autenticados
          Diseño: barra fija debajo del header del sitio, fondo blanco,
          con saludo + nav principal + credenciales alineados en una fila.
      ══════════════════════════════════════════════════════════════════ */}
      {retailerPanel && (
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between gap-4 h-14">

              {/* Saludo compacto */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-none truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-400 leading-none mt-0.5">Revendedor</p>
                </div>
              </div>

              {/* Navegación central */}
              <nav className="flex items-center gap-1">
                {/* Explorar — activo */}
                <Link
                  href="/explorar"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">Explorar</span>
                </Link>

                {/* Mis pedidos */}
                <Link
                  href="/dashboard/pedidos-fraccionados/pedidos"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="hidden sm:inline">Mis pedidos</span>
                </Link>

                {/* Perfil */}
                <Link
                  href="/dashboard/pedidos-fraccionados/perfil"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 text-sm font-medium transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="hidden sm:inline">Perfil</span>
                </Link>
              </nav>

              {/* Credenciales — UserRoleHeader */}
              <div className="flex-shrink-0">
                <UserRoleHeader
                  userEmail={retailerPanel.userEmail}
                  activeRole="retailer"
                  userName={retailerPanel.userName}
                  milestoneBadges={retailerPanel.milestoneBadges}
                  streakBadges={retailerPanel.streakBadges}
                  currentStreak={retailerPanel.currentStreak}
                  paymentLevel={retailerPanel.paymentLevel}
                  completedLots={retailerPanel.completedLots}
                  scoreValue={retailerPanel.scoreValue}
                />
              </div>

            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">

        {/* Onboarding checklist — solo retailer */}
        {retailerPanel && (
          <div className="mb-6">
            <OnboardingChecklist
              userId={retailerPanel.userId}
              hasAddress={retailerPanel.hasAddress}
              hasOrders={retailerPanel.hasOrders}
            />
          </div>
        )}

        {/* Botón volver + título — solo visitantes sin sesión retailer */}
        {!retailerPanel && (
          <>
            <button onClick={() => window.history.back()} className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2 font-medium">
              ← Volver
            </button>
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">Explorar productos</h1>
              <p className="text-gray-600">Comprá directo o participá en pedidos fraccionados</p>
            </div>
          </>
        )}

        {/* LOTES A PUNTO DE CERRAR */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <h2 className="text-xl font-bold text-gray-900">Lotes a punto de cerrar</h2>
              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">≥ 80% completado</span>
            </div>
            <Link href="/explorar/cerrando" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">Ver todos →</Link>
          </div>

          {loadingClosing ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2, 3].map((i) => <div key={i} className="min-w-[260px] h-64 bg-gray-200 rounded-2xl animate-pulse flex-shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
              {closingSoon.slice(0, 8).map((lot) => {
                const urgencyColor = lot.percentage >= 95 ? "bg-red-500" : lot.percentage >= 90 ? "bg-orange-500" : "bg-amber-500";
                const badgeColor = lot.percentage >= 95 ? "bg-red-100 text-red-800" : lot.percentage >= 90 ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800";
                const remainingUnits = lot.minimumOrder - lot.accumulatedQty;
                return (
                  <Link key={lot.lotId} href={`/explorar/${lot.productId}`} className="min-w-[260px] max-w-[260px] flex-shrink-0 snap-start bg-white rounded-2xl shadow hover:shadow-lg transition overflow-hidden flex flex-col border border-gray-100 hover:border-blue-200">
                    <div className="relative h-36 bg-white overflow-hidden border-b border-gray-100">
                      {lot.imageUrls && lot.imageUrls.length > 0 ? (
                        <img src={lot.imageUrls[0]} alt={lot.productName} loading="lazy" decoding="async" className="w-full h-full object-contain hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}>🔥 {lot.percentage}%</span>
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-grow">
                      {lot.manufacturerName && <p className="text-xs text-gray-400 mb-1 truncate">{lot.manufacturerName}</p>}
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">{lot.productName}</p>
                      <div className="mb-2">
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full ${urgencyColor}`} style={{ width: `${lot.percentage}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Faltan <strong>{remainingUnits}</strong> u. para cerrar</p>
                      </div>
                      <p className="text-xs font-bold text-gray-900 mt-auto">${lot.productPrice.toLocaleString("es-AR")}{lot.unitLabel ? ` / ${lot.unitLabel}` : " / u."}</p>
                    </div>
                  </Link>
                );
              })}
              <Link href="/explorar/cerrando" className="min-w-[140px] flex-shrink-0 snap-start bg-blue-50 border-2 border-dashed border-blue-300 rounded-2xl flex flex-col items-center justify-center gap-2 text-blue-600 hover:bg-blue-100 transition p-6 text-center">
                <span className="text-3xl">→</span>
                <span className="text-sm font-semibold">Ver todos</span>
              </Link>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">

          {/* SIDEBAR FILTROS */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow p-6 sticky top-20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg">Filtros</h2>
                <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">Limpiar</button>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">Buscar</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nombre del producto..."
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchLoading && (
                    <div className="absolute right-2 top-2">
                      <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">Categoría</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as ProductCategory | "all")}>
                  <option value="all">Todas las categorías</option>
                  {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">Precio</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Mín" className="border rounded px-3 py-2 text-sm" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                  <input type="number" placeholder="Máx" className="border rounded px-3 py-2 text-sm" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-sm font-medium mb-2">Pedido mínimo</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="Mín" className="border rounded px-3 py-2 text-sm" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
                  <input type="number" placeholder="Máx" className="border rounded px-3 py-2 text-sm" value={maxOrder} onChange={(e) => setMaxOrder(e.target.value)} />
                </div>
              </div>
              <div className="mb-5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={onlyFeatured} onChange={(e) => setOnlyFeatured(e.target.checked)} />
                  <span className="text-sm">Solo destacados</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ordenar por</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  suppressHydrationWarning
                >
                  <option value="name" suppressHydrationWarning>Nombre A-Z</option>
                  <option value="activity" suppressHydrationWarning>Más activos primero</option>
                  <option value="price_asc" suppressHydrationWarning>Precio: menor a mayor</option>
                  <option value="price_desc" suppressHydrationWarning>Precio: mayor a menor</option>
                  <option value="min_asc" suppressHydrationWarning>Pedido mín: menor a mayor</option>
                  <option value="min_desc" suppressHydrationWarning>Pedido mín: mayor a menor</option>
                </select>
              </div>
            </div>
          </aside>

          {/* LISTA DE PRODUCTOS */}
          <div className="lg:col-span-3">
            <div className="mb-4 text-sm text-gray-600">
              {filteredProducts.length} producto{filteredProducts.length !== 1 && "s"} encontrado{filteredProducts.length !== 1 && "s"}
              {hasMore && " (hay más por cargar)"}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-12 text-center">
                <p className="text-gray-500 text-lg">No se encontraron productos con estos filtros</p>
                <button onClick={clearFilters} className="mt-4 text-blue-600 hover:underline">Limpiar filtros</button>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => {
                    const sellerBadge = getSellerBadge(product.sellerType);
                    const outOfStock = isOutOfStock(product);

                    return (
                      <div key={product.id} className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden flex flex-col">

                        {/* IMAGEN */}
                        <div className="relative h-48 bg-white overflow-hidden border-b border-gray-100">
                          {product.imageUrls && product.imageUrls.length > 0 ? (
                            <img
                              src={product.imageUrls[0]}
                              alt={product.name}
                              loading="lazy"
                              decoding="async"
                              className={`w-full h-full object-contain hover:scale-105 transition-transform duration-300 ${outOfStock ? "opacity-60 grayscale" : ""}`}
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${outOfStock ? "opacity-60" : ""}`}>
                              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}

                          {outOfStock && (
                            <div className="absolute top-2 right-2">
                              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">Sin stock</span>
                            </div>
                          )}

                          {product.featured && (
                            <div className="absolute top-2 left-2">
                              <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">⭐ Destacado</span>
                            </div>
                          )}

                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                            <div className="relative">
                              <div className={`w-9 h-9 rounded-full p-0.5 shadow ${product.manufacturerVerified ? "bg-blue-500" : "bg-white/80"}`}>
                                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                                  {product.manufacturerImageUrl ? (
                                    <img src={product.manufacturerImageUrl} alt={product.manufacturerName || "Vendedor"} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                      {product.manufacturerName ? product.manufacturerName.charAt(0).toUpperCase() : "V"}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {product.manufacturerVerified && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {product.isIntermediary && (
                              <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow">Intermediario</span>
                            )}
                          </div>
                        </div>

                        {/* CONTENIDO */}
                        <div className="p-6 flex flex-col flex-grow">
                          <div className="flex items-center gap-2 mb-2">
                            {product.manufacturerName && (
                              <p className="text-xs text-gray-400 truncate">{product.manufacturerName}</p>
                            )}
                            {sellerBadge && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${sellerBadge.colors}`}>
                                {sellerBadge.label}
                              </span>
                            )}
                          </div>

                          <h2 className="text-lg font-semibold mb-2 line-clamp-2">{product.name}</h2>
                          <p className="text-xs text-gray-500 mb-3">{CATEGORY_LABELS[product.category]}</p>

                          <div className="mb-3">
                            <span className="font-medium text-gray-900">Precio: </span>
                            <span className="font-bold text-gray-900">
                              ${product.price.toLocaleString("es-AR")}
                              {product.unitLabel && (
                                <span className="text-gray-500 font-normal text-sm"> / {product.unitLabel}</span>
                              )}
                            </span>
                            {product.variants && product.variants.length > 0 && product.variants.map((v, i) => (
                              <span key={i} className="text-gray-500 text-sm">
                                {"  "}·{"  "}
                                <span className="font-semibold text-gray-800">${v.price.toLocaleString("es-AR")}</span>
                                <span className="text-gray-400"> / {v.unitLabel}</span>
                              </span>
                            ))}
                          </div>

                          <p className="text-sm text-gray-600 mb-3">
                            Pedido mínimo: {product.minimumOrder}{" "}
                            {product.unitLabel ? `unidades (${product.unitLabel} c/u)` : "unidades"}
                          </p>

                          {/* BARRA DE PROGRESO DEL LOTE */}
                          {product.accumulatedQty !== undefined && product.accumulatedQty > 0 && product.minimumOrder > 0 && (
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>📦 Lote en curso</span>
                                <span>{product.accumulatedQty} / {product.minimumOrder} uds.</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min((product.accumulatedQty / product.minimumOrder) * 100, 100)}%`
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <Link
                            href={`/explorar/${product.id}`}
                            className={`mt-auto w-full text-center py-2 rounded-lg transition font-medium ${
                              outOfStock
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {outOfStock ? "Sin stock disponible" : "Ver producto →"}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

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
                      ) : "Cargar más productos"}
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