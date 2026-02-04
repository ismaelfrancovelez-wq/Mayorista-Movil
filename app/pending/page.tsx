import Link from "next/link";
export default function PendingPage() {
  return (
    <main className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">
        ⏳ Pago pendiente
      </h1>

      <p className="mb-4">
        Tu pago está siendo procesado.
      </p>

      <p className="text-sm text-gray-600 mb-6">
        Esto puede demorar unos minutos. Cuando se confirme,
        tu pedido se procesará automáticamente.
      </p>

      <Link
  href="/products"
  className="inline-block bg-black text-white px-4 py-2 rounded"
>
  Volver al catálogo
</Link>
    </main>
  );
}