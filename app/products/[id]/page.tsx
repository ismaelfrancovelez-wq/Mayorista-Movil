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
  factoryId: string;
  allowPickup: boolean;
  allowFactoryShipping: boolean;
  noShipping: boolean;
  unitLabel?: string;
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

async function getProductById(id: string): Promise<Product | null> {
  const snap = await db.collection("products").doc(id).get();
  if (!snap.exists) return null;

  const data = snap.data();
  const methods: string[] = data?.shipping?.methods ?? [];

  return {
    id: snap.id,
    name: data?.name ?? "",
    price: data?.price ?? 0,
    MF: data?.minimumOrder ?? 0,
    factoryId: data?.factoryId ?? "",
    allowPickup: methods.includes("factory_pickup"),
    allowFactoryShipping:
      methods.includes("own_logistics") || methods.includes("third_party"),
    noShipping: data?.shipping?.noShipping === true,
    unitLabel: data?.unitLabel || undefined,
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

async function getHasFactoryAddress(factoryId: string): Promise<boolean> {
  if (!factoryId) return false;
  const snap = await db.collection("manufacturers").doc(factoryId).get();
  if (!snap.exists) return false;
  const data = snap.data();
  return !!(data?.address?.formattedAddress);
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

  const retiroLot = await getFraccionadoLot(product.id, "fraccionado_retiro");
  const envioLot = await getFraccionadoLot(product.id, "fraccionado_envio");
  const hasFactoryAddress = await getHasFactoryAddress(product.factoryId);

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

      <ProductPurchaseClient
        price={product.price}
        MF={product.MF}
        productId={product.id}
        factoryId={product.factoryId}
        allowPickup={product.allowPickup}
        allowFactoryShipping={product.allowFactoryShipping}
        hasFactoryAddress={hasFactoryAddress}
        noShipping={product.noShipping}
        unitLabel={product.unitLabel}
      />
    </main>
  );
}