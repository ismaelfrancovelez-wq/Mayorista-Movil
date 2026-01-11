export default function FailurePage() {
  return (
    <main className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">
        ❌ El pago no se pudo completar
      </h1>

      <p className="mb-4">
        Hubo un problema al procesar el pago.
      </p>

      <p className="text-sm text-gray-600 mb-6">
        No se realizó ningún cargo. Podés intentarlo nuevamente.
      </p>

      <a
        href="/products"
        className="inline-block bg-black text-white px-4 py-2 rounded"
      >
        Volver al catálogo
      </a>
    </main>
  );
}