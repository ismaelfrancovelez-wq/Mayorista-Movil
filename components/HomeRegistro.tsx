// components/HomeRegistro.tsx - Landing Page con proceso unificado

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';

type FeaturedProduct = {
  id: string;
  itemId: string;
  metadata: {
    name: string;
  };
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
  metadata: {
    name: string;
    description: string;
  };
  itemData: {
    id: string;
    name: string;
    description: string;
    address: string;
  };
};

export default function HomeRegistro() {
  const router = useRouter();
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [featuredFactories, setFeaturedFactories] = useState<FeaturedFactory[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingFactories, setLoadingFactories] = useState(true);

  // Cargar productos destacados
  useEffect(() => {
    async function loadFeaturedProducts() {
      try {
        const res = await fetch("/api/featured/active?type=product");
        if (res.ok) {
          const data = await res.json();
          setFeaturedProducts(data.items || []);
        }
      } catch (error) {
        console.error("Error cargando productos destacados:", error);
      } finally {
        setLoadingProducts(false);
      }
    }

    loadFeaturedProducts();
  }, []);

  // Cargar fábricas destacadas
  useEffect(() => {
    async function loadFeaturedFactories() {
      try {
        const res = await fetch("/api/featured/active?type=factory");
        if (res.ok) {
          const data = await res.json();
          setFeaturedFactories(data.items || []);
        }
      } catch (error) {
        console.error("Error cargando fábricas destacadas:", error);
      } finally {
        setLoadingFactories(false);
      }
    }

    loadFeaturedFactories();
  }, []);

  // Función para redirigir al login con el rol guardado en localStorage
  const handleRoleSelection = (role: 'retailer' | 'manufacturer') => {
    localStorage.setItem('selectedRole', role);
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      
      {/* HERO - Profesional */}
      <section className="relative min-h-screen flex items-center justify-center">
        <Image
          src="/hero.jpeg"
          alt="Mayorista Móvil"
          fill
          priority
          className="object-cover brightness-[0.35]"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80 z-[1]"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-8 text-center mt-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-10 leading-tight">
            <span className="block text-white drop-shadow-2xl mb-2">
              Comprá y vendé a precios de fabrica,
            </span>
            <span className="block text-blue-400 drop-shadow-2xl">
              incluso sin llegar al mínimo
            </span>
          </h1>

          {/* Botones de registro por rol */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center max-w-2xl mx-auto mb-8">
            <button
              onClick={() => handleRoleSelection('retailer')}
              className="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold rounded-xl transition-all transform hover:scale-105 shadow-2xl flex items-center justify-center gap-3"
            >
              <span className="text-2xl">🛒</span>
              Soy Revendedor
            </button>
            
            <button
              onClick={() => handleRoleSelection('manufacturer')}
              className="w-full sm:w-auto px-10 py-5 bg-amber-600 hover:bg-amber-700 text-white text-xl font-bold rounded-xl transition-all transform hover:scale-105 shadow-2xl flex items-center justify-center gap-3"
            >
              <span className="text-2xl">🏭</span>
              Soy Fabricante
            </button>
          </div>

          <p className="text-sm text-slate-300 mb-4">
            ¿Ya tenés cuenta? <Link href="/login" className="text-blue-400 hover:text-blue-300 underline font-semibold">Iniciá sesión</Link>
          </p>
        </div>
      </section>

      {/* PRODUCTOS DESTACADOS */}
      {!loadingProducts && featuredProducts.length > 0 && (
        <section className="py-28 bg-white">
          <div className="max-w-7xl mx-auto px-8">
            <div className="max-w-3xl mb-20">
              <div className="mb-6">
                <span className="inline-block bg-amber-100 text-amber-800 px-4 py-1.5 rounded-md text-sm font-semibold tracking-wide uppercase">
                  Selección destacada
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                Productos Destacados
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Descubrí los productos más solicitados del momento, seleccionados por su calidad, precio competitivo y disponibilidad inmediata.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {featuredProducts.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={`/explorar/${item.itemData.id}`}
                  className="bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 p-6 group"
                >
                  <div className="mb-4">
                    <span className="inline-block bg-amber-500 text-white text-xs px-3 py-1 rounded font-semibold uppercase tracking-wide shadow-sm">
                      Destacado
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg mb-3 group-hover:text-blue-600 transition line-clamp-2 min-h-[3.5rem] text-slate-900">
                    {item.itemData.name}
                  </h3>

                  <p className="text-sm text-slate-500 mb-4 uppercase tracking-wide font-medium">
                    {item.itemData.category}
                  </p>

                  <div className="border-t border-slate-100 pt-4 mb-4">
                    <p className="text-blue-700 font-bold text-2xl">
                      ${item.itemData.price.toLocaleString("es-AR")}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Precio por unidad
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded px-3 py-2 mb-4">
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold">Pedido mínimo:</span> {item.itemData.minimumOrder} unidades
                    </p>
                  </div>

                  <div className="text-blue-600 font-semibold text-sm group-hover:underline flex items-center justify-between">
                    <span>Ver detalles</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FÁBRICAS DESTACADAS */}
      {!loadingFactories && featuredFactories.length > 0 && (
        <section className="py-28 bg-slate-50">
          <div className="max-w-7xl mx-auto px-8">
            <div className="max-w-3xl mb-20">
              <div className="mb-6">
                <span className="inline-block bg-blue-100 text-blue-800 px-4 py-1.5 rounded-md text-sm font-semibold tracking-wide uppercase">
                  Red de fabricantes
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                Fábricas Destacadas
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Trabajamos con los fabricantes más confiables de la región, garantizando calidad, transparencia y cumplimiento en cada transacción.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {featuredFactories.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-300 p-6"
                >
                  <div className="mb-4">
                    <span className="inline-block bg-blue-600 text-white text-xs px-3 py-1 rounded font-semibold uppercase tracking-wide shadow-sm">
                      Verificada
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg mb-3 min-h-[3.5rem] text-slate-900">
                    {item.itemData.name}
                  </h3>

                  {item.itemData.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3 leading-relaxed min-h-[4rem]">
                      {item.itemData.description}
                    </p>
                  )}

                  {item.itemData.address && (
                    <div className="bg-slate-50 rounded px-3 py-2 flex items-start gap-2">
                      <span className="text-slate-400 mt-0.5">📍</span>
                      <p className="text-xs text-slate-600 line-clamp-2 font-medium">
                        {item.itemData.address}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BENEFICIOS MEJORADOS */}
      <section className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mx-auto text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 leading-tight">
              Beneficios de usar Mayorista Móvil
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Una plataforma diseñada para maximizar el valor tanto para revendedores como para fabricantes, sin costos ocultos ni comisiones.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto">
            
            {/* Para revendedores */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-2 border-slate-200 p-10 hover:border-blue-400 transition-all">
              <div className="mb-8 pb-6 border-b border-slate-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🛒</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Para revendedores
                  </h3>
                </div>
                <p className="text-slate-600">Compra inteligente al por mayor</p>
              </div>

              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Precios de fábrica con/sin intermediarios</p>
                    <p className="text-sm text-slate-600">• Accedé directamente a los mejores precios mayoristas, eliminando intermediarios y aumentando tu margen de ganancia</p>
                    <p className="text-sm text-slate-600">• La plataforma puede funcionar como intermediario en algunos casos donde la fabrica todavia no a publicado sus productos</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Compras desde 10 unidades</p>
                    <p className="text-sm text-slate-600">Unite a otros compradores para alcanzar el mínimo de fábrica. No necesitás comprar todo el lote vos solo</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Sin gran inversión inicial</p>
                    <p className="text-sm text-slate-600">Empezá o expandí tu negocio sin necesidad de invertir miles de pesos en stock que tal vez no vendas</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Reembolso disponible</p>
                    <p className="text-sm text-slate-600">Mientras el lote esté en progreso, podés solicitar reembolso total de tu dinero si cambiás de opinión</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 bg-blue-600 rounded-xl p-5 mt-6">
                  <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">
                      Todo por 0% de comisión
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Para fabricantes */}
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-2 border-slate-200 p-10 hover:border-blue-400 transition-all">
              <div className="mb-8 pb-6 border-b border-slate-200">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏭</span>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Para fabricantes
                  </h3>
                </div>
                <p className="text-slate-600">Venta directa y eficiente</p>
              </div>

              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Nuevo mercado de pedidos fraccionados</p>
                    <p className="text-sm text-slate-600">Accedé a compradores que antes no alcanzaban tu mínimo. Convertí consultas perdidas en ventas reales</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Nosotros gestionamos la logística</p>
                    <p className="text-sm text-slate-600">En pedidos fraccionados, nosotros nos encargamos del envío y separación. Vos solo despachás como siempre</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Pago seguro y garantizado</p>
                    <p className="text-sm text-slate-600">El dinero se retiene hasta que se completa el lote. Una vez cerrado, se libera automáticamente</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Vendés sin cambiar tu operación</p>
                    <p className="text-sm text-slate-600">Seguís fabricando y despachando como siempre, sin modificar tus procesos actuales</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 bg-blue-600 rounded-xl p-5 mt-6">
                  <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">
                      Todo por 0% de comisión
                    </p>
                  </div>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA - Título profesional */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              ¿Cómo funciona paso a paso?
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Un proceso transparente y seguro diseñado para simplificar las operaciones mayoristas
            </p>
          </div>
        </div>
      </section>

      {/* PARA REVENDEDORES - PROCESO UNIFICADO EN UN SOLO RECUADRO */}
      <section className="py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mb-12">
            <div className="mb-6">
              <span className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-md text-sm font-semibold tracking-wide uppercase">
                Proceso completo para revendedores
              </span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Del registro a recibir tu producto
            </h3>
            <p className="text-lg text-slate-600">
              Te explicamos todo el proceso desde que te registrás hasta que recibís tu mercadería
            </p>
          </div>

          {/* CONTENEDOR UNIFICADO CON TODOS LOS PASOS */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 md:p-12 shadow-xl hover:border-blue-400 transition-all">
            
            <div className="space-y-12">
              
              {/* PASO 1 */}
              <div className="flex items-start gap-6 relative">
                {/* Línea vertical conectora */}
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-purple-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    1
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📝</span>
                    <h4 className="font-bold text-2xl text-slate-900">Registrate en la plataforma</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Hacé clic en "Soy Revendedor"</span> arriba en los botones azules
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Iniciá sesión con Google</span> (recomendado - es instantáneo) o creá una cuenta con tu email
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Completá tu perfil</span> con tu dirección de entrega (la necesitamos para enviarte los productos)
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-blue-900">💡 ¡Listo! Ya podés empezar a comprar. No se cobra nada por registrarte.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 2 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-purple-400 to-indigo-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    2
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🔍</span>
                    <h4 className="font-bold text-2xl text-slate-900">Encontrá el producto que necesitás</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Explorá por categorías</span> (Indumentaria, Electrónica, Hogar, etc.)
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Usá el buscador</span> para encontrar productos específicos
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Mirá el precio por unidad</span> y el pedido mínimo de cada producto
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Verificá la barra de progreso</span> para ver cuántas unidades faltan para completar el lote
                    </p>
                  </div>
                </div>
              </div>

              {/* PASO 3 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-indigo-400 to-green-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    3
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🎯</span>
                    <h4 className="font-bold text-2xl text-slate-900">Elegí cómo comprar</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                      <p className="font-bold text-blue-900 mb-2 text-lg">📦 Compra Fraccionada (Recomendado)</p>
                      <p className="text-slate-700 mb-2">Comprás desde <span className="font-bold">10 unidades</span> (menos que el mínimo de fábrica)</p>
                      <p className="text-sm text-slate-600">✓ Te unís a un lote con otros compradores</p>
                      <p className="text-sm text-slate-600">✓ Cuando se completa el mínimo, se despacha para todos</p>
                      <p className="text-sm text-slate-600">✓ Podés pedir reembolso mientras el lote esté en progreso</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-5 border-2 border-slate-200">
                      <p className="font-bold text-slate-900 mb-2 text-lg">🏭 Compra Directa</p>
                      <p className="text-slate-700 mb-2">Comprás el pedido mínimo completo (ej: 100 unidades)</p>
                      <p className="text-sm text-slate-600">✓ Despacho inmediato</p>
                      <p className="text-sm text-slate-600">✓ La fábrica gestiona el envío directamente</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 4 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-green-400 to-orange-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    4
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">💳</span>
                    <h4 className="font-bold text-2xl text-slate-900">Pagá de forma segura</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Pagá con MercadoPago</span> (tarjeta de crédito, débito, efectivo en Rapipago/PagoFácil)
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Tu dinero está protegido</span> por MercadoPago hasta que se complete el lote
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• En compras fraccionadas:</span> el pago se retiene hasta que el lote alcanza el mínimo
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• En compras directas:</span> el pago se libera apenas confirmás la compra
                    </p>
                    <div className="bg-green-50 border-l-4 border-green-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-green-900">🔒 Pago 100% seguro con MercadoPago - Plataforma líder en Argentina</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 5 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-orange-400 to-teal-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    5
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">⏳</span>
                    <h4 className="font-bold text-2xl text-slate-900">Esperá a que se complete el lote</h4>
                    <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">Solo en compras fraccionadas</span>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Seguí el progreso en tiempo real</span> desde tu panel de compras
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Recibirás notificaciones</span> cuando otros compradores se unan al lote
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Cuando el lote alcanza el mínimo:</span> se cierra automáticamente y comienza el despacho
                    </p>
                    <div className="bg-orange-50 border-l-4 border-orange-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-orange-900 mb-2">💡 ¿Cambiaste de opinión?</p>
                      <p className="text-sm text-orange-800">Podés solicitar reembolso del 100% de tu dinero mientras el lote esté en progreso. Una vez cerrado el lote, ya no se puede cancelar.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 6 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-teal-400 to-pink-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    6
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">✅</span>
                    <h4 className="font-bold text-2xl text-slate-900">El lote se completa y cierra</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Se alcanzó el mínimo de fábrica:</span> el lote se cierra automáticamente
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Los pagos se liberan:</span> el dinero pasa de estar retenido a la fábrica
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Ya no se aceptan más pedidos</span> para este lote
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Ya no podés solicitar reembolso</span> (tu compra está confirmada)
                    </p>
                    <div className="bg-teal-50 border-l-4 border-teal-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-teal-900">🎉 ¡Tu compra está confirmada! Ahora comienza el proceso de despacho</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 7 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-pink-400 to-cyan-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    7
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📦</span>
                    <h4 className="font-bold text-2xl text-slate-900">La fábrica prepara tu pedido</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• La fábrica recibe la orden completa</span> con todos los pedidos del lote
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Prepara la mercadería</span> de todos los compradores
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• En compras directas:</span> la fábrica te contacta para coordinar el envío
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• En compras fraccionadas:</span> nosotros coordinamos con la fábrica
                    </p>
                  </div>
                </div>
              </div>

              {/* PASO 8 */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 to-emerald-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    8
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🚚</span>
                    <h4 className="font-bold text-2xl text-slate-900">Envío y seguimiento</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                      <p className="font-bold text-blue-900 mb-2">📦 Compras Fraccionadas con Envío:</p>
                      <p className="text-sm text-slate-700 mb-1">• Nosotros gestionamos todo el envío</p>
                      <p className="text-sm text-slate-700 mb-1">• Separamos las cantidades de cada comprador</p>
                      <p className="text-sm text-slate-700 mb-1">• Coordinamos la logística</p>
                      <p className="text-sm text-slate-700">• Recibís código de seguimiento</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-5 border-2 border-green-200">
                      <p className="font-bold text-green-900 mb-2">🏪 Compras Fraccionadas con Retiro:</p>
                      <p className="text-sm text-slate-700 mb-1">• Retirás directamente de la fábrica</p>
                      <p className="text-sm text-slate-700 mb-1">• Te contactamos para coordinar</p>
                      <p className="text-sm text-slate-700">• Sin costo de envío</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-5 border-2 border-slate-200">
                      <p className="font-bold text-slate-900 mb-2">🏭 Compras Directas:</p>
                      <p className="text-sm text-slate-700 mb-1">• La fábrica gestiona el envío directamente</p>
                      <p className="text-sm text-slate-700">• Coordinás con ellos fechas y modalidad</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 9 - FINAL */}
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg animate-pulse">
                    9
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🎁</span>
                    <h4 className="font-bold text-2xl text-emerald-600">¡Recibís tu producto!</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• Tiempo de entrega:</span> Entre 24-72 horas hábiles desde el cierre del lote
                    </p>
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• Verificá tu pedido:</span> Revisá que todo esté correcto (cantidad, calidad)
                    </p>
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• ¿Algún problema?</span> Contactanos desde tu panel de compras
                    </p>
                    <div className="bg-gradient-to-r from-emerald-500 to-green-600 border-l-4 border-emerald-700 p-5 mt-4 rounded-xl shadow-lg">
                      <p className="text-lg font-bold text-white">🎉 ¡Felicitaciones! Ya tenés tu mercadería a precio de fábrica lista para revender</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* PARA FABRICANTES - PROCESO COMPLETO DETALLADO EN UN SOLO RECUADRO */}
      <section className="py-28 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="max-w-3xl mb-12">
            <div className="mb-6">
              <span className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-md text-sm font-semibold tracking-wide uppercase">
                Proceso completo para fabricantes
              </span>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
              Del registro a vender tus productos
            </h3>
            <p className="text-lg text-slate-600">
              Te explicamos todo el proceso desde que te registrás hasta que despachás tu mercadería
            </p>
          </div>

          {/* CONTENEDOR UNIFICADO CON TODOS LOS PASOS PARA FABRICANTES */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-8 md:p-12 shadow-xl hover:border-amber-400 transition-all">
            
            <div className="space-y-12">
              
              {/* PASO 1 - REGISTRO Y VERIFICACIÓN */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-amber-400 to-orange-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    1
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📝</span>
                    <h4 className="font-bold text-2xl text-slate-900">Registrate y verificá tu fábrica</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Hacé clic en "Soy Fabricante"</span> arriba en los botones naranjas
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Iniciá sesión con Google</span> (recomendado) o creá una cuenta con tu email
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Completá el proceso de verificación:</span> cargá tu CUIT, constancia de AFIP, datos fiscales y dirección de tu fábrica
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Esperá aprobación:</span> nuestro equipo verifica tu documentación en 24-48 horas hábiles
                    </p>
                    <div className="bg-amber-50 border-l-4 border-amber-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-amber-900 mb-2">🔒 ¿Por qué verificamos?</p>
                      <p className="text-sm text-amber-800">La verificación garantiza confianza a los compradores y asegura que solo fabricantes legales operen en la plataforma.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 2 - PUBLICAR PRODUCTOS */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-orange-400 to-red-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    2
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📦</span>
                    <h4 className="font-bold text-2xl text-slate-900">Publicá tus productos</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Andá a tu panel de fabricante</span> y hacé clic en "Nuevo Producto"
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Cargá la información del producto:</span> nombre, descripción, categoría, precio por unidad
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Definí tu pedido mínimo:</span> la cantidad mínima que necesitás para despachar (ej: 100 unidades)
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Habilitá los métodos de compra:</span>
                    </p>
                    <div className="ml-6 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <p className="text-sm"><span className="font-semibold text-slate-900">Compra Directa:</span> el comprador paga el mínimo completo y vos gestionás el envío</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <p className="text-sm"><span className="font-semibold text-slate-900">Compra Fraccionada con Envío:</span> nosotros gestionamos el envío y separación</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <p className="text-sm"><span className="font-semibold text-slate-900">Compra Fraccionada con Retiro:</span> el comprador retira de tu fábrica</p>
                      </div>
                    </div>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Cargá información de envío:</span> métodos disponibles, costos, tiempos de preparación
                    </p>
                    <div className="bg-orange-50 border-l-4 border-orange-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-orange-900">💡 Podés habilitar las 3 opciones simultáneamente para maximizar ventas</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 3 - RECIBIR PEDIDOS */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-red-400 to-purple-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    3
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🛒</span>
                    <h4 className="font-bold text-2xl text-slate-900">Los compradores compran tus productos</h4>
                  </div>
                  <div className="space-y-4">
                    <p className="leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-900">Los revendedores encuentran tu producto</span> en la plataforma y realizan pedidos
                    </p>
                    
                    <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                      <p className="font-bold text-blue-900 mb-3">📦 En Compras Directas:</p>
                      <p className="text-sm text-slate-700 mb-1">• El comprador paga el mínimo completo</p>
                      <p className="text-sm text-slate-700 mb-1">• El pago se libera inmediatamente a tu cuenta de MercadoPago</p>
                      <p className="text-sm text-slate-700 mb-1">• Recibís notificación instantánea</p>
                      <p className="text-sm text-slate-700">• Podés empezar a preparar el pedido de inmediato</p>
                    </div>

                    <div className="bg-purple-50 rounded-xl p-5 border-2 border-purple-200">
                      <p className="font-bold text-purple-900 mb-3">🧩 En Compras Fraccionadas:</p>
                      <p className="text-sm text-slate-700 mb-2">• Los compradores compran cantidades menores a tu mínimo (desde 10 unidades)</p>
                      <p className="text-sm text-slate-700 mb-2">• Cada compra se suma a un "lote" hasta alcanzar tu mínimo</p>
                      <p className="text-sm text-slate-700 mb-2">• El dinero se retiene en MercadoPago hasta que el lote se complete</p>
                      <p className="text-sm text-slate-700 mb-2">• Seguís el progreso en tiempo real desde tu panel</p>
                      <p className="text-sm text-slate-700 font-semibold">• Ejemplo: Tu mínimo es 100 unidades</p>
                      <div className="ml-4 mt-2 space-y-1">
                        <p className="text-xs text-slate-600">- Comprador A: 15 unidades → Lote: 15/100</p>
                        <p className="text-xs text-slate-600">- Comprador B: 25 unidades → Lote: 40/100</p>
                        <p className="text-xs text-slate-600">- Comprador C: 30 unidades → Lote: 70/100</p>
                        <p className="text-xs text-slate-600">- Comprador D: 30 unidades → Lote: 100/100 ✅ ¡COMPLETO!</p>
                      </div>
                    </div>

                    <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded">
                      <p className="text-sm font-semibold text-red-900 mb-2">⚠️ Importante sobre pagos retenidos:</p>
                      <p className="text-sm text-red-800">Los compradores pueden pedir reembolso mientras el lote esté en progreso. Una vez que se completa el mínimo, el dinero se libera automáticamente y ya no hay reembolsos posibles.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 4 - CIERRE DEL LOTE */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-purple-400 to-green-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    4
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">✅</span>
                    <h4 className="font-bold text-2xl text-slate-900">El lote se completa y se libera el pago</h4>
                    <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">Solo en fraccionadas</span>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Se alcanzó tu mínimo de fábrica:</span> el lote se cierra automáticamente
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Los pagos se liberan:</span> el dinero de todos los compradores se transfiere a tu cuenta de MercadoPago
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Recibís notificación por email y en la plataforma</span> con el detalle de todos los pedidos
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Ya no se aceptan más pedidos</span> para este lote específico
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Se crea una orden de despacho</span> con todas las cantidades de cada comprador
                    </p>
                    <div className="bg-purple-50 border-l-4 border-purple-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-purple-900">💰 El dinero es 100% tuyo - No cobramos comisión</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 5 - PREPARAR PEDIDO */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-green-400 to-blue-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    5
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📦</span>
                    <h4 className="font-bold text-2xl text-slate-900">Preparás el pedido</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Revisás la orden en tu panel:</span> vas a ver el detalle de cantidades por cada comprador
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Preparás la mercadería total del lote</span> (tu mínimo o más)
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• No necesitás separar pedidos:</span> despachás todo junto como siempre
                    </p>
                    <div className="bg-green-50 border-l-4 border-green-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-green-900 mb-2">💡 ¿Tengo que empaquetar por separado cada pedido?</p>
                      <p className="text-sm text-green-800"><span className="font-bold">No.</span> En pedidos fraccionados con envío, vos despachás todo el lote completo a nuestra dirección y nosotros nos encargamos de separar y enviar a cada comprador. Vos solo fabricás y despachás como siempre.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 6 - DESPACHO */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-teal-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    6
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🚚</span>
                    <h4 className="font-bold text-2xl text-slate-900">Despachás según el tipo de compra</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                      <p className="font-bold text-blue-900 mb-3">🏭 Compra Directa:</p>
                      <p className="text-sm text-slate-700 mb-1">• Vos gestionás el envío directamente con el comprador</p>
                      <p className="text-sm text-slate-700 mb-1">• Coordinás método, fecha y dirección</p>
                      <p className="text-sm text-slate-700 mb-1">• Enviás la mercadería al comprador</p>
                      <p className="text-sm text-slate-700">• Actualizás el estado en tu panel</p>
                    </div>

                    <div className="bg-indigo-50 rounded-xl p-5 border-2 border-indigo-200">
                      <p className="font-bold text-indigo-900 mb-3">📦 Compra Fraccionada con Envío:</p>
                      <p className="text-sm text-slate-700 mb-1">• <span className="font-semibold">Nosotros coordinamos el retiro</span> de la mercadería de tu fábrica</p>
                      <p className="text-sm text-slate-700 mb-1">• Despachás todo el lote completo a nuestra dirección/depósito</p>
                      <p className="text-sm text-slate-700 mb-1">• <span className="font-semibold">Nosotros separamos</span> las cantidades de cada comprador</p>
                      <p className="text-sm text-slate-700 mb-1">• <span className="font-semibold">Nosotros enviamos</span> a cada comprador individual</p>
                      <p className="text-sm text-slate-700">• Sin costo extra para vos - es parte del servicio</p>
                    </div>

                    <div className="bg-green-50 rounded-xl p-5 border-2 border-green-200">
                      <p className="font-bold text-green-900 mb-3">🏪 Compra Fraccionada con Retiro:</p>
                      <p className="text-sm text-slate-700 mb-1">• Los compradores retiran de tu fábrica en horario coordinado</p>
                      <p className="text-sm text-slate-700 mb-1">• Vos preparás los paquetes individuales</p>
                      <p className="text-sm text-slate-700 mb-1">• Te contactamos con fechas estimadas de retiro</p>
                      <p className="text-sm text-slate-700">• Cada comprador retira solo su cantidad</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 7 - NOTIFICACIÓN AL COMPRADOR */}
              <div className="flex items-start gap-6 relative">
                <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gradient-to-b from-teal-400 to-cyan-400"></div>
                
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    7
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📧</span>
                    <h4 className="font-bold text-2xl text-slate-900">Los compradores reciben su mercadería</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Los compradores reciben notificación</span> cuando su pedido está en camino
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• En compras fraccionadas con envío:</span> reciben código de seguimiento
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Tiempo de entrega:</span> 24-72 horas desde el despacho
                    </p>
                    <p className="leading-relaxed">
                      <span className="font-semibold text-slate-900">• Los compradores confirman recepción</span> en la plataforma
                    </p>
                    <div className="bg-teal-50 border-l-4 border-teal-600 p-4 mt-4 rounded">
                      <p className="text-sm font-semibold text-teal-900">💡 Toda comunicación está centralizada en la plataforma para tu tranquilidad</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PASO 8 - CICLO COMPLETO */}
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg animate-pulse">
                    8
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🔄</span>
                    <h4 className="font-bold text-2xl text-cyan-600">¡Ciclo completo! Seguí vendiendo</h4>
                  </div>
                  <div className="space-y-3 text-slate-600">
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• La venta se completa exitosamente</span>
                    </p>
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• Los compradores pueden dejar reseñas</span> sobre tu producto y servicio
                    </p>
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• Aparecés en el historial del comprador</span> para futuras recompras
                    </p>
                    <p className="leading-relaxed text-lg">
                      <span className="font-semibold text-slate-900">• Podés destacar tus productos</span> para mayor visibilidad
                    </p>
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-600 border-l-4 border-cyan-700 p-5 mt-4 rounded-xl shadow-lg">
                      <p className="text-lg font-bold text-white mb-2">🎉 ¡Felicitaciones! Completaste tu primera venta</p>
                      <p className="text-sm text-white">Tu producto sigue disponible y se pueden crear nuevos lotes fraccionados automáticamente. Seguí vendiendo sin límites.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t-2 border-slate-200 py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <p className="font-bold text-slate-900 text-lg mb-2">Mayorista Móvil</p>
              <p className="text-slate-600">© {new Date().getFullYear()} Todos los derechos reservados</p>
            </div>
            <div className="flex gap-10">
              <a href="#" className="text-slate-600 hover:text-blue-600 transition font-medium">Contacto</a>
              <a href="#" className="text-slate-600 hover:text-blue-600 transition font-medium">Términos de servicio</a>
              <a href="#" className="text-slate-600 hover:text-blue-600 transition font-medium">Política de privacidad</a>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}