import Link from "next/link";
import { db } from "../../lib/firebase-admin";

type Product = {
  id: string;
  name: string;
  price: number;
  MF: number;
  accumulatedQty: number;
};

async function getProducts(): Promise<Product[]> {
  const snapshot = await db.collection("products").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      name: data.name,
      price: data.price,
      MF: data.MF,
      accumulatedQty: data.accumulatedQty ?? 0,
    };
  });
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Catálogo mayorista
      </h1>

      {products.length === 0 && (
        <p className="text-gray-500">
          No hay productos cargados.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.map((product) => {
          const progress =
            product.MF > 0
              ? Math.min(
                  (product.accumulatedQty / product.MF) * 100,
                  100
                )
              : 0;

          return (
            <Link
              key={product.id}
              href={"/products/" + product.id}
              className="border rounded-lg p-4 hover:shadow transition block"
            >
              <h2 className="font-semibold text-lg mb-2">
                {product.name}
              </h2>

              <p className="text-sm mb-1">
                Precio base: $ {product.price}
              </p>

              <p className="text-sm mb-2">
                Lote: {product.accumulatedQty} / {product.MF}
              </p>

              <div className="w-full bg-gray-200 rounded h-2">
                <div
                  className="bg-blue-600 h-2 rounded"
                  style={{ width: progress + "%" }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}