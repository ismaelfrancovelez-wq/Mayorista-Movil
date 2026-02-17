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
  const [shippingKm, setShippingKm] = useState<number | null>(null); // ✅ NUEVO: kilómetros
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
      setShippingKm(typeof data.km === "number" ? data.km : null); // ✅ NUEVO: guardar km
    } catch (err) {
      console.error("Error envío plataforma:", err);
      setSelectedShipping("platform");
      setShippingCost(0);
      setShippingKm(null);
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
          setShippingKm(typeof data.km === "number" ? data.km : null); // ✅ NUEVO: guardar km
        } else {
          setSelectedShipping("pickup");
          setShippingCost(0);
          setShippingKm(null);
        }
      } catch (err) {
        console.error("Error envío directo:", err);
        setSelectedShipping("pickup");
        setShippingCost(0);
        setShippingKm(null);
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
              <p className="font-semibold text-red-900 mb-1">
                Producto no disponible para compra
              </p>
              <p className="text-sm text-red-700">
                El fabricante aún no ha vinculado su cuenta de Mercado Pago. 
                Por favor, intentá más tarde.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Cantidad</label>
        <input
          type="number"
          className="border rounded px-3 py-2 w-full"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          min={1}
        />
        <p className="text-xs text-gray-500 mt-1">
          Mínimo de fábrica: {MF} unidades
        </p>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Opciones de entrega:</p>

        <label className="block mb-1">
          <input
            type="radio"
            name="shipping"
            checked={selectedShipping === "pickup"}
            onChange={() => {
              setSelectedShipping("pickup");
              setShippingCost(0);
              setShippingKm(null); // ✅ NUEVO: limpiar km
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
                : (
                    <>
                      Envío por plataforma: ${shippingCost.toLocaleString()}
                      {/* ✅ NUEVO: Mostrar kilómetros */}
                      {shippingKm !== null && (
                        <span className="text-sm text-gray-600 ml-1">
                          ({shippingKm} km)
                        </span>
                      )}
                    </>
                  )}
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
                : (
                    <>
                      Envío por fábrica: ${shippingCost.toLocaleString()}
                      {/* ✅ NUEVO: Mostrar kilómetros */}
                      {shippingKm !== null && (
                        <span className="text-sm text-gray-600 ml-1">
                          ({shippingKm} km)
                        </span>
                      )}
                    </>
                  )}
            </span>
          </label>
        )}
      </div>

      <div className="border rounded p-4 text-sm mb-6 bg-gray-50">
        <p>Subtotal producto: $ {productSubtotal.toLocaleString()}</p>
        {commission > 0 && <p>Comisión (12%): $ {commission.toLocaleString()}</p>}
        <p>Envío: $ {shippingCost.toLocaleString()}</p>
        <p className="font-semibold mt-2 text-base">
          Total: $ {totalToCharge.toLocaleString()}
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