// components/products/ProductPurchaseClient.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Props = {
  price: number;
  MF: number;
  productId: string;
};

type ShippingMode = "pickup" | "factory" | "platform";

export default function ProductPurchaseClient({ price, MF, productId }: Props) {
  const [qty, setQty] = useState(1);
  const isFraccionado = qty < MF;
  
  const [selectedShipping, setSelectedShipping] = useState<ShippingMode>("pickup");
  const [shippingCost, setShippingCost] = useState(0);
  const [loadingShipping, setLoadingShipping] = useState(false);
  
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [loadingMPStatus, setLoadingMPStatus] = useState(true);
  const [factoryId, setFactoryId] = useState<string | null>(null);

  useEffect(() => {
    async function checkFactoryMPStatus() {
      setLoadingMPStatus(true);
      try {
        const productRes = await fetch(`/api/products/explore`);
        if (!productRes.ok) throw new Error("Error cargando producto");
        
        const { products } = await productRes.json();
        const product = products.find((p: any) => p.id === productId);
        
        if (!product || !product.factoryId) {
          setMpConnected(false);
          return;
        }
        
        setFactoryId(product.factoryId);

        const mpRes = await fetch(`/api/manufacturers/mp-status-public?factoryId=${product.factoryId}`);
        if (!mpRes.ok) {
          setMpConnected(false);
          return;
        }
        
        const mpData = await mpRes.json();
        setMpConnected(mpData.connected === true);
      } catch (err) {
        console.error("Error verificando MP:", err);
        setMpConnected(false);
      } finally {
        setLoadingMPStatus(false);
      }
    }

    checkFactoryMPStatus();
  }, [productId]);

  const calculatePlatformShipping = useCallback(async () => {
    setLoadingShipping(true);
    try {
      const res = await fetch("/api/shipping/fraccionado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();
      setSelectedShipping("platform");
      setShippingCost(typeof data.shippingCost === "number" ? data.shippingCost : 0);
    } catch (err) {
      console.error("Error envío plataforma:", err);
      setSelectedShipping("platform");
      setShippingCost(0);
    } finally {
      setLoadingShipping(false);
    }
  }, [productId]);

  useEffect(() => {
    if (isFraccionado) {
      calculatePlatformShipping();
      return;
    }

    async function calculateDirectShipping() {
      setLoadingShipping(true);
      try {
        const res = await fetch("/api/shipping/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, qty }),
        });

        const data = await res.json();

        if (data && typeof data.shippingCost === "number" && data.shippingMode) {
          setSelectedShipping(data.shippingMode);
          setShippingCost(data.shippingCost);
        } else {
          setSelectedShipping("pickup");
          setShippingCost(0);
        }
      } catch (err) {
        console.error("Error envío directo:", err);
        setSelectedShipping("pickup");
        setShippingCost(0);
      } finally {
        setLoadingShipping(false);
      }
    }

    calculateDirectShipping();
  }, [qty, MF, productId, isFraccionado, calculatePlatformShipping]);

  const productSubtotal = price * qty;
  const commission = isFraccionado ? Math.round(productSubtotal * 0.12) : 0;
  const totalToCharge = useMemo(
    () => productSubtotal + commission + shippingCost,
    [productSubtotal, commission, shippingCost]
  );

  async function handleCheckout() {
    if (mpConnected === false) {
      alert("⚠️ Este producto no está disponible para compra.\n\nEl fabricante aún no ha vinculado su cuenta de Mercado Pago.");
      return;
    }

    if (loadingMPStatus) {
      alert("⏳ Verificando disponibilidad...");
      return;
    }

    const orderType = isFraccionado ? "fraccionado" : "directa";
    const lotType = isFraccionado
      ? selectedShipping === "pickup" ? "fraccionado_retiro" : "fraccionado_envio"
      : selectedShipping === "pickup" ? "directa_retiro" : "directa_envio";

    const res = await fetch("/api/payments/mercadopago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Compra Mayorista",
        unitPrice: totalToCharge,
        qty: 1,
        originalQty: qty,
        productId,
        orderType,
        lotType,
        shippingMode: selectedShipping,
        shippingCost,
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
    }
  }

  return (
    <div className="border rounded-xl p-6 mt-8 bg-white shadow">
      
      {!loadingMPStatus && mpConnected === false && (
        <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <p className="font-semibold text-red-800 mb-1">
                Producto no disponible temporalmente
              </p>
              <p className="text-sm text-red-700">
                El fabricante aún no ha vinculado su cuenta de Mercado Pago para recibir pagos.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm mb-1">Cantidad</label>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="border rounded px-3 py-2 w-32"
          disabled={mpConnected === false}
        />
        {isFraccionado && (
          <p className="text-xs text-gray-500 mt-1">
            Pedido fraccionado (mínimo {MF})
          </p>
        )}
      </div>

      <div className="mb-5">
        <p className="font-semibold mb-2">Forma de envío</p>

        <label className="block">
          <input
            type="radio"
            name="shipping"
            checked={selectedShipping === "pickup"}
            onChange={() => {
              setSelectedShipping("pickup");
              setShippingCost(0);
            }}
            disabled={mpConnected === false}
          />
          <span className="ml-2">Retiro en fábrica (Gratis)</span>
        </label>

        {isFraccionado && (
          <label className="block mt-1">
            <input
              type="radio"
              name="shipping"
              checked={selectedShipping === "platform"}
              onChange={calculatePlatformShipping}
              disabled={mpConnected === false}
            />
            <span className="ml-2">
              {loadingShipping
                ? "Calculando envío..."
                : `Envío por plataforma: $ ${shippingCost}`}
            </span>
          </label>
        )}

        {!isFraccionado && (
          <label className="block mt-1">
            <input
              type="radio"
              name="shipping"
              checked={selectedShipping === "factory"}
              onChange={() => setSelectedShipping("factory")}
              disabled={mpConnected === false}
            />
            <span className="ml-2">
              {loadingShipping
                ? "Calculando envío..."
                : `Envío por fábrica: $ ${shippingCost}`}
            </span>
          </label>
        )}
      </div>

      <div className="border rounded p-4 text-sm mb-6 bg-gray-50">
        <p>Subtotal producto: $ {productSubtotal}</p>
        {commission > 0 && <p>Comisión (12%): $ {commission}</p>}
        <p>Envío: $ {shippingCost}</p>
        <p className="font-semibold mt-2 text-base">
          Total: $ {totalToCharge}
        </p>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loadingMPStatus || mpConnected === false}
        className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingMPStatus 
          ? "Verificando disponibilidad..." 
          : mpConnected === false
          ? "Producto no disponible"
          : "Continuar al pago"}
      </button>
    </div>
  );
}