import { db } from "../../../lib/firebase-admin";
import ProductPurchaseClient from "../../../components/products/ProductPurchaseClient";

/* ===============================
   TIPOS
================================ */

type Product = {
  id: string;
  name: string;
  price: number;
  MF: number;
};

type FraccionadoLot = {
  accumulatedQty: number;
  MF: number;
  status: "accumulating" | "closed";
};

type Props = {
  params: { id: string };
};

/* ===============================
   DATA
================================ */

async function getProductById(
  id: string
): Promise<Product | null> {
  const snap = await db.collection("products").doc(id).get();
  if (!snap.exists) return null;

  const data = snap.data();

  return {
    id: snap.id,
    name: data?.name ?? "",
    price: data?.price ?? 0,
    MF: data?.minimumQuantity ?? 0,
  };
}

async function getFraccionadoLot(
  productId: string,
  lotType: "fraccionado_retiro" | "fraccionado_envio"
): Promise<FraccionadoLot | null> {
  const snap = await db
    .collection("lots")
    .doc(`${productId}_${lotType}`)
    .get();

  if (!snap.exists) return null;

  const data = snap.data();

  return {
    accumulatedQty: data?.accumulatedQty ?? 0,
    MF: data?.MF ?? 0,
    status: data?.status ?? "accumulating",
  };
}

/* ===============================
   PAGE
================================ */

export default async function ProductPage({ params }: Props) {
  const product = await getProductById(params.id);

  if (!product) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">
          Producto no encontrado
        </h1>
      </main>
    );
  }

  const retiroLot = await getFraccionadoLot(
    product.id,
    "fraccionado_retiro"
  );

  const envioLot = await getFraccionadoLot(
    product.id,
    "fraccionado_envio"
  );

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        {product.name}
      </h1>

      <p className="text-lg mb-4">
        Precio base: $ {product.price}
      </p>

      {retiroLot && (
        <p className="text-sm text-gray-600 mb-1">
          Fraccionado – Retiro:{" "}
          {retiroLot.accumulatedQty}/{retiroLot.MF}
        </p>
      )}

      {envioLot && (
        <p className="text-sm text-gray-600 mb-4">
          Fraccionado – Envío:{" "}
          {envioLot.accumulatedQty}/{envioLot.MF}
        </p>
      )}

      {/* 👇 SOLO PASA LO NECESARIO */}
      <ProductPurchaseClient
  price={product.price}
  MF={product.MF}
  productId={product.id}
/>
    </main>
  );
}