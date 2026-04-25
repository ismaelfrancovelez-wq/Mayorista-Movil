// components/HomePrincipal.tsx - Home Principal Funcional
// ✅ ACTUALIZADO: agregados roles distribuidor y mayorista
// ✅ OPTIMIZADO:
//   1. Los lotes de productos destacados se cargan en PARALELO con Promise.all
//   2. passive: true en el scroll listener
// ✅ FIX (3 cambios mínimos):
//   A. Búsqueda del header pasa el término a /explorar?search=X
//   B. Secciones vacías (Productos Destacados y Fábricas Destacadas) se ocultan si no hay datos
//   C. Nombres de productos limpian SKUs internos [CODIGO] en el render
// ✅ NUEVO: explainer aparece primero, dura 8s, resto 5s, botón de pausa

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type FeaturedProduct = {
  id: string;
  itemId: string;
  itemData: {
    id: string;
    name: string;
    price: number;
    minimumOrder: number;
    category: string;
  };
};

type FeaturedFactory = {
  id: string;
  itemId: string;
  itemData: {
    id: string;
    name: string;
    description: string;
    address: string;
  };
};

type Product = {
  id: string;
  name: string;
  price: number;
  minimumOrder: number;
  shippingMethods: string[];
  category?: string;
};

type LotData = {
  accumulatedQty: number;
  MF: number;
  progress?: number;
};

// ✅ NUEVO: tipo para los contadores públicos reales
type PublicStats = {
  lotsCompleted: number;
  totalUsers: number;
  verifiedFactories: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  alimentos: "Alimentos",
  bebidas: "Bebidas",
  indumentaria: "Indumentaria",
  calzado: "Calzado",
  electronica: "Electrónica",
  hogar: "Hogar",
  construccion: "Construcción",
  salud_belleza: "Salud y Belleza",
  jugueteria: "Juguetería",
  libreria: "Librería",
  deportes: "Deportes",
  automotor: "Automotor",
  mascotas: "Mascotas",
  otros: "Otros",
};

const CATEGORY_ICONS: Record<string, string> = {
  alimentos: '🍕',
  bebidas: '🥤',
  indumentaria: '👕',
  calzado: '👟',
  electronica: '📱',
  hogar: '🏠',
  construccion: '🔨',
  salud_belleza: '💄',
  jugueteria: '🧸',
  libreria: '📚',
  deportes: '⚽',
  automotor: '🚗',
  mascotas: '🐾',
  otros: '📦',
};

const CATEGORY_COLORS: Record<string, string> = {
  alimentos: 'bg-orange-500',
  bebidas: 'bg-blue-500',
  indumentaria: 'bg-pink-500',
  calzado: 'bg-purple-500',
  electronica: 'bg-indigo-500',
  hogar: 'bg-green-500',
  construccion: 'bg-yellow-600',
  salud_belleza: 'bg-rose-500',
  jugueteria: 'bg-red-500',
  libreria: 'bg-cyan-500',
  deportes: 'bg-lime-500',
  automotor: 'bg-slate-600',
  mascotas: 'bg-amber-500',
  otros: 'bg-gray-500',
};

function cleanProductName(name: string): string {
  return name.replace(/\s*\[[^\]]+\]\s*/g, '').trim();
}

type HomePrincipalProps = {
  initialStats?: PublicStats | null;
  initialProducts?: Product[];
  initialFeaturedProducts?: FeaturedProduct[];
  initialFeaturedFactories?: FeaturedFactory[];
};

export default function HomePrincipal({
  initialStats = null,
  initialProducts = [],
  initialFeaturedProducts = [],
  initialFeaturedFactories = [],
}: HomePrincipalProps) {
  const router = useRouter();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [isPaused, setIsPaused] = useState(false); // ✅ NUEVO
  const [scrollY, setScrollY] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>(initialFeaturedProducts);
  const [featuredFactories, setFeaturedFactories] = useState<FeaturedFactory[]>(initialFeaturedFactories);
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [productLots, setProductLots] = useState<Record<string, LotData>>({});

  const [loadingFeaturedProducts, setLoadingFeaturedProducts] = useState(initialFeaturedProducts.length === 0);
  const [loadingFeaturedFactories, setLoadingFeaturedFactories] = useState(initialFeaturedFactories.length === 0);
  const [loadingAllProducts, setLoadingAllProducts] = useState(initialProducts.length === 0);

  const [stats, setStats] = useState<PublicStats | null>(initialStats);
  const [loadingStats, setLoadingStats] = useState(initialStats === null);

  const testimonials = [
    {
      initial: 'L',
      name: 'Laura M.',
      role: 'Revendedora, GBA Norte',
      text: 'Compré 2 griferías para mi local de baños. El lote cerró en 3 días con otros compradores. Pagué precio de fábrica sin tener que pedir 10 unidades.',
    },
    {
      initial: 'R',
      name: 'Roberto S.',
      role: 'Revendedor online, CABA',
      text: 'Lo mejor es que podés reservar y esperar a que se complete el lote. Si no cierra, te devuelven la plata. Sin riesgo.',
    },
    {
      initial: 'V',
      name: 'Valeria T.',
      role: 'Distribuidora, Rosario',
      text: 'Accedí a productos de Kanji Home a precio directo. Como revendedora es un cambio enorme: antes tenía que comprar 50 unidades mínimo.',
    },
  ];

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadAllData() {
      const fetchList: Promise<any>[] = [fetch('/api/auth/me')];
      const needsFeaturedProducts  = initialFeaturedProducts.length === 0;
      const needsFeaturedFactories = initialFeaturedFactories.length === 0;
      const needsProducts          = initialProducts.length === 0;
      const needsStats             = initialStats === null;

      if (needsFeaturedProducts)  fetchList.push(fetch('/api/featured/active?type=product'));
      if (needsFeaturedFactories) fetchList.push(fetch('/api/featured/active?type=factory'));
      if (needsProducts)          fetchList.push(fetch('/api/products/explore?page=1'));
      if (needsStats)             fetchList.push(fetch('/api/stats/public'));

      const results = await Promise.allSettled(fetchList);
      let idx = 0;

      try {
        const authRes = results[idx++];
        if (authRes.status === 'fulfilled' && authRes.value.ok) {
          const data = await authRes.value.json();
          setIsAuthenticated(!!data.userId);
        }
      } catch (e) {
        console.error('Error verificando autenticación:', e);
      } finally {
        setIsLoading(false);
      }

      if (needsFeaturedProducts) {
        try {
          const res = results[idx++];
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json();
            setFeaturedProducts(data.items || []);
          }
        } catch (e) {
          console.error('Error cargando productos destacados:', e);
        } finally {
          setLoadingFeaturedProducts(false);
        }
      }

      if (needsFeaturedFactories) {
        try {
          const res = results[idx++];
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json();
            setFeaturedFactories(data.items || []);
          }
        } catch (e) {
          console.error('Error cargando fábricas destacadas:', e);
        } finally {
          setLoadingFeaturedFactories(false);
        }
      }

      if (needsProducts) {
        try {
          const res = results[idx++];
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json();
            setAllProducts(data.products || []);
          }
        } catch (e) {
          console.error('Error cargando productos:', e);
        } finally {
          setLoadingAllProducts(false);
        }
      }

      if (needsStats) {
        try {
          const res = results[idx++];
          if (res.status === 'fulfilled' && res.value.ok) {
            const data = await res.value.json();
            setStats(data);
          }
        } catch (e) {
          console.error('Error cargando stats:', e);
        } finally {
          setLoadingStats(false);
        }
      }
    }

    loadAllData();
  }, []);

  useEffect(() => {
    async function loadProductLots() {
      if (featuredProducts.length === 0) return;

      const results = await Promise.all(
        featuredProducts.map(async (product) => {
          try {
            const res = await fetch(`/api/lots/${product.itemData.id}`);
            if (!res.ok) return { id: product.itemData.id, data: null };
            const data = await res.json();
            const progress = data.MF > 0 ? Math.round((data.accumulatedQty / data.MF) * 100) : 0;
            return {
              id: product.itemData.id,
              data: { accumulatedQty: data.accumulatedQty || 0, MF: data.MF || 0, progress },
            };
          } catch (error) {
            console.error(`Error cargando lote para producto ${product.itemData.id}:`, error);
            return { id: product.itemData.id, data: null };
          }
        })
      );

      const lotsData: Record<string, LotData> = {};
      results.forEach(({ id, data }) => { if (data) lotsData[id] = data; });
      setProductLots(lotsData);
    }

    if (!loadingFeaturedProducts && featuredProducts.length > 0) {
      loadProductLots();
    }
  }, [featuredProducts, loadingFeaturedProducts]);

  // ✅ NUEVO: explainer (índice 0) dura 8s, el resto 5s. Se pausa con isPaused.
  const banners: Array<{
    title: string;
    subtitle: string;
    bgColor: string;
    image: string;
    cta: string;
    type?: 'explainer';
  }> = [
    {
      title: '¿Cómo funciona?',
      subtitle: 'Comprá en grupo, pagá menos.',
      bgColor: 'from-violet-700 via-violet-800 to-purple-900',
      image: '',
      cta: 'Ver cómo funciona',
      type: 'explainer'
    },
    {
      title: '¡Pedidos desde 1 unidad!',
      subtitle: 'Comprá a precio de fábrica sin invertir grandes volúmenes.',
      bgColor: 'from-blue-600 via-blue-700 to-blue-900',
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200',
      cta: 'Explorar'
    },
    {
      title: '¡Fábricas Célebres!',
      subtitle: 'Encontrarás productos de las fábricas más importantes.',
      bgColor: 'from-zinc-600 via-zinc-700 to-zinc-900',
      image: 'https://images.unsplash.com/photo-1615797534094-7fde0a4861f3?w=1200',
      cta: 'Explorar'
    },
    {
      title: '¡Fábricas Verificadas!',
      subtitle: 'Podés buscar productos de forma segura y tranquila.',
      bgColor: 'from-emerald-600 via-emerald-700 to-emerald-900',
      image: 'https://images.unsplash.com/photo-1603899122406-e7eb957f9fd6?w=1200',
      cta: 'Explorar'
    },
    {
      title: '¡Lotes a Punto De Cerrar!',
      subtitle: 'Unite antes de que se completen.',
      bgColor: 'from-orange-600 via-orange-700 to-orange-900',
      image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200',
      cta: 'Ver Lotes'
    },
  ];

  const categories = Object.keys(CATEGORY_LABELS).map(key => ({
    id: key,
    name: CATEGORY_LABELS[key],
    icon: CATEGORY_ICONS[key] || '📦',
    color: CATEGORY_COLORS[key] || 'bg-gray-500',
    count: allProducts.filter(p => p.category === key).length
  })).filter(cat => cat.count > 0);

  // ✅ NUEVO: explainer (índice 0) dura 8s, resto 5s, se pausa con isPaused
  useEffect(() => {
    if (isPaused) return;
    const duration = currentBanner === 0 ? 8000 : 5000;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, duration);
    return () => clearInterval(interval);
  }, [banners.length, currentBanner, isPaused]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRoleRedirect = (targetRole: 'retailer' | 'manufacturer' | 'distributor' | 'wholesaler') => {
    if (isAuthenticated) {
      if (targetRole === 'retailer') {
        router.push('/explorar');
      } else {
        router.push('/dashboard/fabricante');
      }
    } else {
      router.push(`/login?role=${targetRole}`);
    }
  };

  const handleLoginClick = () => {
    if (isAuthenticated) {
      router.push('/perfil');
    } else {
      router.push('/registro');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER PRINCIPAL */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'shadow-lg' : ''}`}>
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">📍 Envíos a todo el país</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/ayuda" className="hover:text-blue-300 transition">¿Necesitás ayuda?</Link>
              <Link href="/como-funciona" className="hover:text-blue-300 transition">¿Cómo funciona?</Link>
            </div>
          </div>
        </div>

        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform shadow-lg">
                  <span className="text-2xl font-black text-white">M</span>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">MayoristaMovil</h1>
                  <p className="text-xs text-gray-500 font-medium">Compra fraccionada</p>
                </div>
              </Link>

              <div className="flex-1 max-w-2xl">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const term = searchInputRef.current?.value?.trim();
                  if (term) {
                    router.push(`/explorar?search=${encodeURIComponent(term)}`);
                  } else {
                    router.push('/explorar');
                  }
                }}>
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Buscar productos, fábricas, categorías..."
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                    <button type="submit" className="absolute right-0 top-0 bottom-0 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-r-lg hover:from-blue-700 hover:to-blue-800 transition-all">🔍</button>
                  </div>
                </form>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleLoginClick} className="hidden lg:flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition">
                  <span className="text-2xl">👤</span>
                  <div className="text-left">
                    <p className="text-xs text-gray-500">{isAuthenticated ? 'Mi' : 'Hola,'}</p>
                    <p className="text-sm font-semibold">{isAuthenticated ? 'Perfil' : 'Ingresá'}</p>
                  </div>
                </button>
                {isAuthenticated && (
                  <>
                    <Link href="/mis-compras" className="hidden md:flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition">
                      <span className="text-2xl">📦</span>
                      <div className="text-left">
                        <p className="text-xs text-gray-500">Mis</p>
                        <p className="text-sm font-semibold">Compras</p>
                      </div>
                    </Link>
                    <Link href="/carrito" className="relative px-4 py-2 hover:bg-gray-100 rounded-lg transition">
                      <span className="text-3xl">🛒</span>
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">0</span>
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
              <Link href="/explorar" className="text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap">Todas las categorías</Link>
              <span className="text-gray-300">|</span>
              <Link href="/explorar/cerrando" className="text-sm text-gray-700 hover:text-blue-600 whitespace-nowrap transition">Lotes por cerrar</Link>
              <button onClick={() => handleRoleRedirect('retailer')} className="text-sm text-gray-700 hover:text-blue-600 whitespace-nowrap transition cursor-pointer">Soy revendedor</button>
              <button onClick={() => handleRoleRedirect('manufacturer')} className="text-sm text-gray-700 hover:text-blue-600 whitespace-nowrap transition cursor-pointer">Soy fabricante</button>
              <button onClick={() => handleRoleRedirect('distributor')} className="text-sm text-gray-700 hover:text-purple-600 whitespace-nowrap transition cursor-pointer">Soy distribuidor</button>
              <button onClick={() => handleRoleRedirect('wholesaler')} className="text-sm text-gray-700 hover:text-green-600 whitespace-nowrap transition cursor-pointer">Soy mayorista</button>
            </div>
          </div>
        </div>
      </header>

      {/* CUADRO DE INTRODUCCIÓN */}
      <section className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border-2 border-white/30 p-6 md:p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">ENCONTRA TODO A PRECIO DE FABRICA</h2>
                <p className="text-white/80 text-lg max-w-2xl">Comprá todo a precio de fabrica uniendote con otros compradores y revendedores para realizar pequeños pedidos, de hasta 1 unidad, hasta llegar al minimo de fabrica y recibir tu producto.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/como-funciona" className="px-8 py-4 bg-white text-blue-700 font-black rounded-xl hover:bg-yellow-300 hover:text-blue-900 transition-all transform hover:scale-105 shadow-2xl text-center">¿Cómo funciona? →</Link>
                <Link href="/explorar" className="px-8 py-4 bg-yellow-400 text-blue-900 font-black rounded-xl hover:bg-yellow-300 transition-all transform hover:scale-105 shadow-2xl text-center">Explorar productos</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      {!loadingStats && stats && (stats.lotsCompleted > 0 || stats.totalUsers > 0 || stats.verifiedFactories > 0) && (
        <section className="bg-white border-b border-gray-100 py-6">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black text-blue-600">
                  {stats.lotsCompleted > 0 ? `+${stats.lotsCompleted}` : '—'}
                </span>
                <span className="text-sm text-gray-600 font-medium">Lotes completados</span>
              </div>
              <div className="flex flex-col items-center gap-1 border-x border-gray-100">
                <span className="text-3xl font-black text-blue-600">
                  {stats.totalUsers > 0 ? `+${stats.totalUsers}` : '—'}
                </span>
                <span className="text-sm text-gray-600 font-medium">Compradores registrados</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-black text-blue-600">
                  {stats.verifiedFactories > 0 ? stats.verifiedFactories : '—'}
                </span>
                <span className="text-sm text-gray-600 font-medium">Fábricas verificadas</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BANNER CAROUSEL */}
      <section className="relative h-[400px] md:h-[500px] overflow-hidden bg-gradient-to-br from-slate-900 to-slate-700">
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-bold z-30">{currentBanner + 1} / {banners.length}</div>
        {banners.map((banner, index) => (
          <div key={index} className={`absolute inset-0 transition-all duration-700 ${currentBanner === index ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
            <div className={`absolute inset-0 bg-gradient-to-r ${banner.bgColor} opacity-95`} />
            {banner.image && <img src={banner.image} alt={banner.title} className="w-full h-full object-cover mix-blend-overlay" />}

            {banner.type === 'explainer' ? (
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-7xl mx-auto px-6 w-full">
                  <h2 className="text-3xl md:text-4xl font-black text-white mb-2 text-center">{banner.title}</h2>
                  <p className="text-white/80 text-center mb-6 md:mb-8 text-base md:text-lg">{banner.subtitle}</p>
                  <div className="grid grid-cols-4 gap-3 md:gap-6 mb-6">
                    {[
                      { emoji: '🛒', step: '1', label: 'Elegí tu producto' },
                      { emoji: '📋', step: '2', label: 'Reservá tu lugar' },
                      { emoji: '⏳', step: '3', label: 'El lote se llena' },
                      { emoji: '💰', step: '4', label: 'Pagás y recibís' },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl md:text-3xl border border-white/30">
                          {item.emoji}
                        </div>
                        <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Paso {item.step}</span>
                        <span className="text-white text-xs md:text-sm font-semibold leading-tight">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <Link href="#como-funciona">
                      <button className="px-6 py-3 bg-white text-violet-700 font-bold rounded-xl hover:bg-violet-50 transition-all shadow-xl text-sm md:text-base">
                        Ver explicación completa →
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-7xl mx-auto px-4 w-full">
                  <div className="max-w-2xl">
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight animate-fade-in-up">{banner.title}</h2>
                    <p className="text-xl md:text-2xl text-white/90 mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>{banner.subtitle}</p>
                    <Link href={banner.cta === 'Ver Lotes' ? '/explorar/cerrando' : '/explorar'}>
                      <button className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transform hover:scale-105 transition-all shadow-2xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>{banner.cta} →</button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* DOTS */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-20">
          {banners.map((banner, index) => (
            <button key={index} onClick={() => setCurrentBanner(index)} className={`transition-all ${currentBanner === index ? 'bg-white w-8 h-3 rounded-full' : 'bg-white/50 hover:bg-white/75 w-3 h-3 rounded-full'}`} aria-label={`Ir a banner ${index + 1}: ${banner.title}`} title={banner.title} />
          ))}
        </div>

        {/* NAVEGACIÓN */}
        <button onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)} className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-full p-3 transition-all z-20" aria-label="Banner anterior">←</button>

        {/* ✅ NUEVO: botón pausa centrado arriba de los dots */}
        <button
          onClick={() => setIsPaused((prev) => !prev)}
          className="absolute left-1/2 -translate-x-1/2 bottom-16 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-full px-4 py-1.5 transition-all z-20 text-xs font-medium flex items-center gap-1.5"
          aria-label={isPaused ? 'Reanudar' : 'Pausar'}
        >
          {isPaused ? '▶ Reanudar' : '⏸ Pausar'}
        </button>

        <button onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)} className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-full p-3 transition-all z-20" aria-label="Banner siguiente">→</button>
      </section>

      {/* CATEGORÍAS */}
      <section className="max-w-7xl mx-auto px-4 -mt-16 relative z-10 mb-12">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Explorar por categoría</h3>
          {loadingAllProducts ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-3 p-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-2xl animate-pulse" />
                  <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {categories.slice(0, 8).map((category) => (
                <Link key={category.id} href={`/explorar?category=${category.id}`} className="group">
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-gray-50 transition-all cursor-pointer">
                    <div className={`w-16 h-16 ${category.color} rounded-2xl flex items-center justify-center text-3xl transform group-hover:scale-110 group-hover:rotate-3 transition-all shadow-lg`}>{category.icon}</div>
                    <div className="text-center">
                      <p className="font-semibold text-sm text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-500">{category.count} productos</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay categorías disponibles</p>
          )}
        </div>
      </section>

      {/* PRODUCTOS DESTACADOS */}
      {(loadingFeaturedProducts || featuredProducts.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 mb-12">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-3xl font-black mb-2">⭐ Productos Destacados</h3>
                <p className="text-lg opacity-90">Los mejores productos seleccionados para vos</p>
              </div>
              <Link href="/explorar" className="hidden md:flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-xl hover:bg-white/30 transition-all font-semibold">Ver todos →</Link>
            </div>
            {loadingFeaturedProducts ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl overflow-hidden shadow-xl">
                    <div className="w-full h-48 bg-gray-200 animate-pulse" />
                    <div className="p-4 space-y-3">
                      <div className="h-6 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                      <div className="h-8 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredProducts.slice(0, 3).map((product) => {
                  const lotData = productLots[product.itemData.id];
                  const progress = lotData?.progress || 0;
                  const accumulated = lotData?.accumulatedQty || 0;
                  const minimum = lotData?.MF || product.itemData.minimumOrder;
                  const displayName = cleanProductName(product.itemData.name);
                  return (
                    <Link key={product.id} href={`/explorar/${product.itemData.id}`}>
                      <div className="bg-white rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-2 cursor-pointer">
                        <div className="relative">
                          <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center"><span className="text-6xl">📦</span></div>
                          <div className="absolute top-3 right-3 bg-yellow-500 text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">⭐ Destacado</div>
                        </div>
                        <div className="p-4">
                          <h4 className="font-bold text-gray-900 mb-1 line-clamp-2">{displayName}</h4>
                          <p className="text-sm text-gray-500 mb-3">{product.itemData.category}</p>
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">Progreso del lote</span>
                              <span className="font-bold text-blue-600">{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{accumulated} de {minimum} unidades</p>
                          </div>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-2xl font-black text-gray-900">${product.itemData.price.toLocaleString()}</span>
                            <span className="text-xs text-gray-500">por unidad</span>
                          </div>
                          <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 shadow-lg">Ver detalles</button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* CÓMO FUNCIONA */}
      <section className="max-w-7xl mx-auto px-4 mb-12">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
          <h3 className="text-3xl font-black text-gray-900 mb-2 text-center">¿Cómo funciona la compra fraccionada?</h3>
          <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto"></p>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 transform hover:scale-110 transition-all shadow-xl"><span className="font-black text-white drop-shadow-md tracking-tight">1</span></div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Elegí tu producto</h4>
              <p className="text-gray-600">Busca en el explorador, el producto que quieras o necesites, y elije entre compra directa o fraccionada.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 transform hover:scale-110 transition-all shadow-xl"><span className="font-black text-white drop-shadow-md tracking-tight">2</span></div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Reserva con compra fraccionada</h4>
              <p className="text-gray-600">Cada fabrica/distribuidor o mayorista tiene un minimo para sus productos. Podras realizar compras menores a estos minimos. En compras de cantidades menores al minimo (compras fraccionadas), podras hacer la reserva de tu producto sin necesidad de pagar al instante. Cuando completas tu reserva, te unes a la barra de progreso junto a otros compradores para llegar al minimo de fabrica. </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 transform hover:scale-110 transition-all shadow-xl"><span className="font-black text-white drop-shadow-md tracking-tight">3</span></div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Baja de reserva</h4>
              <p className="text-gray-600">Mientras el lote no se halla completado podras darte de baja sin ningun tipo de problema. Una ves completado el minimo deberas realizar el pago sin exepcion, ya que la reserva constituye un compromiso de espera y pago entre todos los compradores. </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 transform hover:scale-110 transition-all shadow-xl"><span className="font-black text-white drop-shadow-md tracking-tight">4</span></div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Pago</h4>
              <p className="text-gray-600">Una ves que el lote se completa, se te notificara dentro de la plataforma y por medio de WhatsApp, junto con un link de pago por correo electronico, para recordarte completar el pago.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 transform hover:scale-110 transition-all shadow-xl"><span className="font-black text-white drop-shadow-md tracking-tight">5</span></div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Recibí tu pedido</h4>
              <p className="text-gray-600">Una ves que todos los compradores hallan pagado, se liberara la totalidad del dinero hacia el vendedor, y tu resibiras el producto dentro de las 24 a 72hs.</p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link href="/como-funciona" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all">Conocer más detalles →</Link>
          </div>
        </div>
      </section>

      {/* FÁBRICAS DESTACADAS */}
      {(loadingFeaturedFactories || featuredFactories.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-3xl font-black text-gray-900">🏭 Fábricas Destacadas</h3>
              <p className="text-gray-600">Las mejores fábricas verificadas de la plataforma</p>
            </div>
            <Link href="/explorar" className="text-blue-600 font-semibold hover:text-blue-700 transition">Ver todas →</Link>
          </div>
          {loadingFeaturedFactories ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100">
                  <div className="h-40 bg-gray-200 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredFactories.slice(0, 6).map((factory) => (
                <div key={factory.id} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all transform hover:-translate-y-1 border border-gray-100">
                  <div className="relative h-40 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-6xl">🏭</span>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute top-3 right-3 bg-blue-600 text-white px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1">✓ Verificada</div>
                    <div className="absolute bottom-3 left-3 right-3"><h4 className="font-bold text-white text-lg line-clamp-1">{factory.itemData.name}</h4></div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2 h-10">{factory.itemData.description || 'Fabricante verificado'}</p>
                    {factory.itemData.address && (
                      <div className="bg-slate-50 rounded px-3 py-2 flex items-start gap-2">
                        <span className="text-slate-400 mt-0.5">📍</span>
                        <p className="text-xs text-slate-600 line-clamp-2 font-medium">{factory.itemData.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TESTIMONIOS */}
      <section className="max-w-7xl mx-auto px-4 mb-12">
        <div className="text-center mb-8">
          <h3 className="text-3xl font-black text-gray-900 mb-2">Lo que dicen nuestros revendedores</h3>
          <p className="text-gray-600">Compradores reales que ya usaron la plataforma</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex gap-1 text-yellow-400 text-sm">
                {'★★★★★'.split('').map((s, j) => <span key={j}>{s}</span>)}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed flex-1">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {t.initial}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-16 mb-12">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-black text-center mb-12">¿Por qué comprar en MayoristaMovil?</h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💰</div>
              <h4 className="font-bold text-lg mb-2">Precios mayoristas</h4>
              <p className="text-gray-300 text-sm">Accedes a precios de fabrica, distribuidores y mayoristas comprando pocas cantidades.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🚚</div>
              <h4 className="font-bold text-lg mb-2">Fábricas más Importantes</h4>
              <p className="text-gray-300 text-sm">Tendrás acceso a productos de las fábricas más importantes y reconocidas del mercado. Tambien tendras acceso a distribuidores y mayoristas oficiales de fabricas.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
              <h4 className="font-bold text-lg mb-2">Fábricas Verificadas</h4>
              <p className="text-gray-300 text-sm">Podés comprar de forma tranquila con nuestras fábricas verificadas.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🔒</div>
              <h4 className="font-bold text-lg mb-2">Mercado Pago</h4>
              <p className="text-gray-300 text-sm">Integración directa de Mercado Pago para pagos completamente seguros.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🚚</div>
              <h4 className="font-bold text-lg mb-2">Envío Rápido</h4>
              <p className="text-gray-300 text-sm">Recibí tu pedido en 24-72hs una vez que el lote se completa.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center"><span className="text-xl font-black">M</span></div>
                <span className="font-bold text-lg">MayoristaMovil</span>
              </div>
              <p className="text-gray-400 text-sm">La plataforma de compra mayorista fraccionada más grande de Argentina.</p>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Compradores</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/explorar" className="hover:text-white transition">Explorar productos</Link></li>
                <li><Link href="/como-funciona" className="hover:text-white transition">Cómo funciona</Link></li>
                <li><Link href="/preguntas-frecuentes" className="hover:text-white transition">Preguntas frecuentes</Link></li>
                <li><Link href="/politicas" className="hover:text-white transition">Políticas de compra</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Vendedores</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/vender" className="hover:text-white transition">Vender en MayoristaMovil</Link></li>
                <li><Link href="/verificacion" className="hover:text-white transition">Verificación de fábrica</Link></li>
                <li><Link href="/dashboard/fabricante" className="hover:text-white transition">Panel de vendedor</Link></li>
                <li><Link href="/comisiones" className="hover:text-white transition">Comisiones y tarifas</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Seguinos</h4>
              <div className="flex gap-4 mb-6">
                <a href="#" className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-700 transition">f</a>
                <a href="#" className="w-10 h-10 bg-blue-400 rounded-lg flex items-center justify-center hover:bg-blue-500 transition">t</a>
                <a href="#" className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center hover:bg-pink-700 transition">i</a>
              </div>
              <h4 className="font-bold text-sm mb-2">Suscribite a nuestro newsletter</h4>
              <div className="flex gap-2">
                <input type="email" placeholder="Tu email" className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-blue-500 outline-none" />
                <button className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">→</button>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center"><span className="text-xl font-black">M</span></div>
              <div>
                <p className="font-bold">MayoristaMovil</p>
                <p className="text-xs text-gray-400">© 2025 Todos los derechos reservados</p>
              </div>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link href="/terminos" className="hover:text-white transition">Términos y condiciones</Link>
              <Link href="/privacidad" className="hover:text-white transition">Privacidad</Link>
              <Link href="/cookies" className="hover:text-white transition">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* FLOATING ACTION BUTTON */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 hover:scale-110 transition-all flex items-center justify-center text-2xl z-50">💬</button>

      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}