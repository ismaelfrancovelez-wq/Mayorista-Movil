"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  price: number;
  MF: number;
  productId: string;
  retailerId: string;
};

type ShippingMode = "pickup" | "factory" | "platform";

export default function ProductPurchaseClient({
  price,
  MF,
  productId,
  retailerId,
}: Props) {
  const [qty, setQty] = useState(1);

  const [platformShippingCost, setPlatformShippingCost] = useState(0);
  const [factoryShippingCost, setFactoryShippingCost] = useState(0);

  const [selectedShipping, setSelectedShipping] =
    useState<ShippingMode>("platform");

  const isFraccionado = qty < MF;

  /* ===============================
     🚚 CALCULAR ENVÍO
  =============================== */
  useEffect(() => {
    async function fetchShipping() {
      const res = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          retailerId,
          qty,
        }),
      });

      const data = await res.json();

      if (data.shippingMode === "platform") {
        setPlatformShippingCost(data.shippingCost);
      }

      if (data.shippingMode === "factory") {
        setFactoryShippingCost(data.shippingCost);
      }

      if (data.shippingMode === "pickup") {
        setFactoryShippingCost(0);
      }
    }

    fetchShipping();
    setSelectedShipping(isFraccionado ? "platform" : "factory");
  }, [qty, productId, retailerId, isFraccionado]);

  /* ===============================
     💰 PRECIOS (FRONT = ÚNICA VERDAD)
  =============================== */
  const productSubtotal = price * qty;

  // 🔥 COMISIÓN SIEMPRE EN FRACCIONADO (retiro o envío)
  const commission = isFraccionado
    ? productSubtotal * 0.12
    : 0;

  const finalShippingCost =
    selectedShipping === "pickup"
      ? 0
      : isFraccionado
      ? platformShippingCost
      : factoryShippingCost;

  // 🔒 TOTAL FINAL REAL
  const totalToCharge = useMemo(
    () => productSubtotal + commission + finalShippingCost,
    [productSubtotal, commission, finalShippingCost]
  );

  /* ===============================
     💳 CHECKOUT (PASO 5 DEFINITIVO)
  =============================== */
  async function handleCheckout() {
    const shippingMode: ShippingMode =
      selectedShipping === "pickup"
        ? "pickup"
        : isFraccionado
        ? "platform"
        : "factory";

    const orderType = isFraccionado ? "fraccionado" : "directa";

    const lotType = isFraccionado
      ? selectedShipping === "pickup"
        ? "fraccionado_retiro"
        : "fraccionado_envio"
      : selectedShipping === "pickup"
      ? "directa_retiro"
      : "directa_envio";

    const res = await fetch("/api/payments/mercadopago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
  title: "Compra Mayorista",
  qty: 1,
  unitPrice: totalToCharge,
  originalQty: qty,

  productId,
  retailerId,
  orderType,
  lotType,
  shippingMode,
  shippingCost: finalShippingCost,
  commission,
  MF,
}),
    });

    if (!res.ok) {
      alert("Error iniciando pago");
      return;
    }

    const data = await res.json();

    if (data?.init_point) {
      window.location.href = data.init_point;
    } else {
      alert("Error iniciando pago");
    }
  }

  /* ===============================
     🧾 UI
  =============================== */
  return (
    <div className="border rounded p-4 mt-6">
      <div className="mb-4">
        <label className="block text-sm mb-1">Cantidad</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="border rounded px-2 py-1 w-24"
        />
      </div>

      <div className="mb-4">
        <p className="font-semibold mb-2">Forma de envío</p>

        <label className="block">
          <input
            type="radio"
            checked={selectedShipping === "pickup"}
            onChange={() => setSelectedShipping("pickup")}
          />
          <span className="ml-2">Retiro en fábrica (Gratis)</span>
        </label>

        <label className="block mt-1">
          <input
            type="radio"
            checked={selectedShipping !== "pickup"}
            onChange={() =>
              setSelectedShipping(isFraccionado ? "platform" : "factory")
            }
          />
          <span className="ml-2">
            {isFraccionado ? (
              <>Envío por plataforma ($ {platformShippingCost})</>
            ) : (
              <>Envío por fábrica ($ {factoryShippingCost})</>
            )}
          </span>
        </label>
      </div>

      <div className="border rounded p-3 text-sm mb-4">
        <p>Subtotal producto: $ {productSubtotal}</p>
        {commission > 0 && <p>Comisión (12%): $ {commission}</p>}
        <p>Envío: $ {finalShippingCost}</p>
        <p className="font-semibold mt-2">
          Total: $ {totalToCharge}
        </p>
      </div>

      <button
        onClick={handleCheckout}
        className="w-full bg-black text-white py-2 rounded"
      >
        Continuar al pago
      </button>
    </div>
  );
}