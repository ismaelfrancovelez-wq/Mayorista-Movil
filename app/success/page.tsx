import Link from "next/link";
export default function SuccessPage() {
  return (
    <main className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">
        ✅ Pago realizado con éxito
      </h1>

      <p className="mb-4">
        Tu pago fue confirmado correctamente.
      </p>

      <p className="text-sm text-gray-600 mb-6">
        Si elegiste compra fraccionada, tu pedido ya fue sumado al lote.
        Te avisaremos cuando el lote se complete.
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