// components/HomeRegistro.tsx - Landing Page con proceso unificado
// ✅ MEJORAS:
//   - Promise.all para cargar productos y fábricas en paralelo (antes 2 llamadas secuenciales)
//   - Skeleton loading states profesionales
//   - SEO: <main> semántico con aria-labels
//   - Sección "Cómo funciona" agregada para conversión

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FeaturedProduct = {
  id: string;
  itemId: string;
  metadata: { name: string };
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
  metadata: { name: string; description: string };
  itemData: {
    id: string;
    name: string;
    description: string;
    address: string;
  };
};

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
      <div className="h-5 w-20 bg-slate-200 rounded mb-4" />
      <div className="h-5 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-3/4 bg-slate-200 rounded mb-4" />
      <div className="h-8 w-1/2 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-full bg-slate-200 rounded" />
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "🛒",
    title: "Elegí tu rol",
    desc: "¿Sos revendedor o fabricante? Registrate gratis en menos de 2 minutos.",
  },
  {
    step: "02",
    icon: "📦",
    title: "Explorá productos",
    desc: "Accedé a precios de fábrica directos, sin intermediarios ni recargos.",
  },
  {
    step: "03",
    icon: "🤝",
    title: "Comprá en grupo",
    desc: "Si no llegás al mínimo, uníte a otros revendedores y comprá fraccionado.",
  },
  {
    step: "04",
    icon: "🚚",
    title: "Recibí tu pedido",
    desc: "Seguí tu pedido en tiempo real y recibilo en tu puerta.",
  },
];

export default function HomeRegistro() {
  const router = useRouter();
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [featuredFactories, setFeaturedFactories] = useState<FeaturedFactory[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ CORRECCIÓN: Promise.all — ambas llamadas en paralelo
  useEffect(() => {
    async function loadFeatured() {
      try {
        const [productsRes, factoriesRes] = await Promise.all([
          fetch("/api/featured/active?type=product"),
          fetch("/api/featured/active?type=factory"),
        ]);

        const [productsData, factoriesData] = await Promise.all([
          productsRes.ok ? productsRes.json() : { items: [] },
          factoriesRes.ok ? factoriesRes.json() : { items: [] },
        ]);

        setFeaturedProducts(productsData.items || []);
        setFeaturedFactories(factoriesData.items || []);
      } catch (error) {
        console.error("Error cargando destacados:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFeatured();
  }, []);

  const handleRoleSelection = (role: "retailer" | "manufacturer") => {
    localStorage.setItem("selectedRole", role);
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex items-center justify-center"
        aria-label="Sección principal"
      >
        <Image
          src="/hero.jpeg"
          alt="Mayorista Móvil — compra y venta mayorista"
          fill
          priority
          className="object-cover brightness-[0.35]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80 z-[1]" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm px-4 py-2 rounded-full mb-8 font-medium">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Marketplace mayorista argentino
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            <span className="block text-white drop-shadow-2xl mb-3">
              Comprá y vendé a precios de fábrica,
            </span>
            <span className="block text-blue-400 drop-shadow-2xl">
              incluso sin llegar al mínimo
            </span>
          </h1>

          <p className="text-xl text-white/75 mb-12 max-w-2xl mx-auto leading-relaxed">
            Unís a revendedores con fabricantes. Sin intermediarios. Con compras
            grupales para que todos puedan acceder.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-xl mx-auto mb-8">
            <button
              onClick={() => handleRoleSelection("retailer")}
              className="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-lg font-bold rounded-2xl transition-all transform hover:scale-105 hover:-translate-y-0.5 shadow-2xl shadow-blue-900/40 flex items-center justify-center gap-3"
            >
              <span className="text-2xl">🛒</span>
              Soy Revendedor
            </button>

            <button
              onClick={() => handleRoleSelection("manufacturer")}
              className="w-full sm:w-auto px-10 py-5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-lg font-bold rounded-2xl transition-all transform hover:scale-105 hover:-translate-y-0.5 shadow-2xl shadow-amber-900/40 flex items-center justify-center gap-3"
            >
              <span className="text-2xl">🏭</span>
              Soy Fabricante
            </button>
          </div>

          <p className="text-sm text-white/50">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="text-blue-400 hover:text-blue-300 underline font-semibold transition-colors"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="py-24 bg-white" aria-label="Cómo funciona">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="inline-block bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider mb-4">
              Simple y transparente
            </span>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">¿Cómo funciona?</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              En cuatro pasos, pasás de explorar a recibir tu pedido mayorista.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="relative">
                <div className="bg-slate-50 rounded-2xl p-6 h-full hover:shadow-md transition-shadow">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Paso {item.step}
                  </div>
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTOS DESTACADOS ── */}
      <section className="py-24 bg-slate-50" aria-label="Productos destacados">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-2xl mb-16">
            <span className="inline-block bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider mb-4">
              Selección destacada
            </span>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Productos Destacados</h2>
            <p className="text-lg text-slate-500 leading-relaxed">
              Los productos más solicitados del momento — calidad, precio y disponibilidad inmediata.
            </p>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg">Próximamente habrá productos destacados aquí.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {featuredProducts.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={`/explorar/${item.itemData.id}`}
                  className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 p-6 group flex flex-col"
                >
                  <div className="mb-4">
                    <span className="inline-block bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">
                      Destacado
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[3.5rem] text-slate-900">
                    {item.itemData.name}
                  </h3>

                  <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider font-medium">
                    {item.itemData.category}
                  </p>

                  <div className="mt-auto border-t border-slate-100 pt-4 mb-3">
                    <p className="text-blue-700 font-extrabold text-2xl">
                      ${item.itemData.price.toLocaleString("es-AR")}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">por unidad</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold">Pedido mínimo:</span>{" "}
                      {item.itemData.minimumOrder} unidades
                    </p>
                  </div>

                  <div className="text-blue-600 text-sm font-semibold flex items-center justify-between group-hover:underline">
                    <span>Ver detalles</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/explorar"
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md"
            >
              Ver todos los productos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FÁBRICAS DESTACADAS ── */}
      {!loading && featuredFactories.length > 0 && (
        <section className="py-24 bg-white" aria-label="Fábricas destacadas">
          <div className="max-w-7xl mx-auto px-8">
            <div className="max-w-2xl mb-16">
              <span className="inline-block bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider mb-4">
                Red de fabricantes
              </span>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">Fábricas Destacadas</h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Los fabricantes más confiables de la región — calidad, transparencia y cumplimiento garantizados.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {featuredFactories.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 p-6 flex flex-col"
                >
                  <div className="mb-4">
                    <span className="inline-block bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide">
                      Verificada
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg mb-2 min-h-[3.5rem] text-slate-900">
                    {item.itemData.name}
                  </h3>

                  {item.itemData.description && (
                    <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed min-h-[4rem]">
                      {item.itemData.description}
                    </p>
                  )}

                  {item.itemData.address && (
                    <p className="text-xs text-slate-400 mt-3 flex items-start gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {item.itemData.address}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA FINAL ── */}
      <section className="py-24 bg-blue-700 text-white text-center" aria-label="Registro">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-4xl font-extrabold mb-6">¿Listo para empezar?</h2>
          <p className="text-blue-200 text-lg mb-10 leading-relaxed">
            Registrate gratis hoy y accedé a precios de fábrica desde el primer pedido.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleRoleSelection("retailer")}
              className="px-10 py-4 bg-white text-blue-700 font-bold rounded-2xl hover:bg-blue-50 transition-colors shadow-lg hover:scale-105 transform"
            >
              🛒 Empezar como Revendedor
            </button>
            <button
              onClick={() => handleRoleSelection("manufacturer")}
              className="px-10 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-400 transition-colors shadow-lg hover:scale-105 transform"
            >
              🏭 Empezar como Fabricante
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER MÍNIMO ── */}
      <footer className="bg-slate-900 text-slate-500 text-center text-sm py-6 px-4">
        © {new Date().getFullYear()} Mayorista Móvil. Todos los derechos reservados.
        {" · "}
        <Link href="/terminos" className="hover:text-white transition-colors">Términos</Link>
        {" · "}
        <Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
      </footer>
    </main>
  );
}