"use client";

import { useEffect, useState } from "react";

type Lot = {
  accumulatedQty: number;
  MF: number;
};

export default function TestProductPage() {
  const PRODUCT_PRICE = 2000;
  const PRODUCT_ID = "prod_test_123";
  const MF = 50;

  const FACTORY_SHIPPING = 15000;
  const COMMISSION_RATE = 0.12;

  const [qty, setQty] = useState(18);
  const [shippingFraccionado, setShippingFraccionado] = useState<number | null>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [loadingPay, setLoadingPay] = useState(false);

  // 🔹 Calcular envío fraccionado
  useEffect(() => {
    async function calcularEnvio() {
      const res = await fetch("/api/shipping/fraccionado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factoryAddress: "Av. Corrientes 1234, CABA",
          retailerAddress: "Av. San Martín 2500, Hurlingham",
        }),
      });

      const data = await res.json();
      setShippingFraccionado(Number(data.totalCost));
    }

    calcularEnvio();
  }, []);

  // 🔹 Cargar lote fraccionado
  useEffect(() => {
    async function cargarLote() {
      const res = await fetch("/api/lots/" + PRODUCT_ID);
      const data = await res.json();
      setLot(data);
    }

    cargarLote();
  }, []);

  // 🔹 Cálculos
  const subtotal = PRODUCT_PRICE * qty;

  const directUnitPrice = (subtotal + FACTORY_SHIPPING) / qty;

  const fraccionadoUnitPrice =
    shippingFraccionado !== null
      ? (subtotal + subtotal * COMMISSION_RATE + shippingFraccionado) / qty
      : null;

  const mejorOpcion =
    qty >= MF
      ? "directa"
      : fraccionadoUnitPrice !== null && fraccionadoUnitPrice < directUnitPrice
      ? "fraccionada"
      : "directa";

  // 🔥 PAGO FINAL (UNA SOLA FUNCIÓN)
  async function pagarAhora() {
    if (mejorOpcion === "fraccionada" && fraccionadoUnitPrice === null) {
      alert("Calculando envío fraccionado...");
      return;
    }

    setLoadingPay(true);

    const unitPrice =
      mejorOpcion === "directa"
        ? Number(directUnitPrice.toFixed(2))
        : Number(fraccionadoUnitPrice!.toFixed(2));

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: PRODUCT_ID,
        qty,
        orderType: mejorOpcion,
        unitPrice,
      }),
    });

    const data = await res.json();

    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      alert("Error iniciando el pago");
      setLoadingPay(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 520 }}>
      <h1>Producto de prueba</h1>

      <p>
        <strong>Precio fábrica:</strong> ARS {PRODUCT_PRICE}
      </p>

      <label>Cantidad</label>
      <input
        type="number"
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        min={1}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <hr />

      <h3>Compra directa</h3>
      <p>ARS {directUnitPrice.toFixed(2)} / unidad</p>

      {fraccionadoUnitPrice !== null && (
        <>
          <hr />
          <h3>Compra fraccionada</h3>
          <p>ARS {fraccionadoUnitPrice.toFixed(2)} / unidad</p>

          {lot && lot.accumulatedQty < lot.MF && (
            <div style={{ marginTop: 15 }}>
              <strong>Lote fraccionado</strong>
              <p>
                {lot.accumulatedQty} / {lot.MF}
              </p>

              <div
                style={{
                  height: 10,
                  background: "#eee",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(lot.accumulatedQty / lot.MF) * 100}%`,
                    background: "#4caf50",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      <hr />

      <div style={{ background: "#e6f7e6", padding: 10, marginBottom: 15 }}>
        💡 <strong>Te conviene {mejorOpcion}</strong>
      </div>

      <button
        onClick={pagarAhora}
        disabled={loadingPay}
        style={{
          width: "100%",
          padding: 12,
          fontSize: 16,
          background: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {loadingPay ? "Redirigiendo..." : "Pagar ahora"}
      </button>
    </div>
  );
}