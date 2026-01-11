import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* ===============================
          HERO
      =============================== */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Comprá y vendé al por mayor <br />
          <span className="text-gray-500">
            incluso sin llegar al mínimo
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-12">
          Unimos pedidos de varios revendedores para que accedas
          a precios de fábrica sin asumir grandes volúmenes.
        </p>

        {/* CTA ROLES */}
        <div className="flex flex-col md:flex-row justify-center gap-4">
          <Link
            href="/login?role=retailer"
            className="px-8 py-4 bg-black text-white rounded-lg text-lg font-medium hover:opacity-90 transition"
          >
            Soy revendedor
          </Link>

          <Link
            href="/login?role=manufacturer"
            className="px-8 py-4 border border-black rounded-lg text-lg font-medium hover:bg-gray-100 transition"
          >
            Soy fabricante
          </Link>
        </div>
      </section>

      {/* ===============================
          CÓMO FUNCIONA
      =============================== */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center mb-16">
            ¿Cómo funciona?
          </h2>

          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-4xl mb-4">🛒</div>
              <h3 className="font-semibold text-xl mb-2">
                Compras fraccionadas
              </h3>
              <p className="text-gray-600">
                Varios revendedores compran el mismo producto
                sin alcanzar el mínimo individualmente.
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">📦</div>
              <h3 className="font-semibold text-xl mb-2">
                Se alcanza el mínimo
              </h3>
              <p className="text-gray-600">
                Cuando el lote llega al mínimo de fábrica,
                el pedido se cierra automáticamente.
              </p>
            </div>

            <div>
              <div className="text-4xl mb-4">🚚</div>
              <h3 className="font-semibold text-xl mb-2">
                Envío o retiro
              </h3>
              <p className="text-gray-600">
                Cada revendedor recibe su parte
                o coordina retiro en fábrica.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===============================
          BENEFICIOS
      =============================== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16">
          {/* Revendedores */}
          <div>
            <h3 className="text-2xl font-semibold mb-6">
              Para revendedores
            </h3>
            <ul className="space-y-4 text-gray-700">
              <li>✔️ Comprar al precio de fábrica</li>
              <li>✔️ Sin stock mínimo individual</li>
              <li>✔️ Reembolso si el lote no se completa</li>
              <li>✔️ Envío o retiro en fábrica</li>
            </ul>
          </div>

          {/* Fabricantes */}
          <div>
            <h3 className="text-2xl font-semibold mb-6">
              Para fabricantes
            </h3>
            <ul className="space-y-4 text-gray-700">
              <li>✔️ Ventas aseguradas por volumen</li>
              <li>✔️ Sin marketing ni gestión de clientes</li>
              <li>✔️ Un solo despacho por lote</li>
              <li>✔️ Cobro cuando el lote se completa</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===============================
          CONFIANZA
      =============================== */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-semibold mb-6">
            Pagos protegidos y transparentes
          </h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Los pagos quedan protegidos hasta que el lote se complete.
            Si no se alcanza el mínimo, el dinero se reembolsa automáticamente.
          </p>
        </div>
      </section>

      {/* ===============================
          FOOTER
      =============================== */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-sm text-gray-500 flex justify-between">
          <span>© {new Date().getFullYear()} Mayorista Móvil</span>
          <span>Contacto · Términos · Privacidad</span>
        </div>
      </footer>
    </main>
  );
}