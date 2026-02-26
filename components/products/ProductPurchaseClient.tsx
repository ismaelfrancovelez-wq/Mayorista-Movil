"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Props = {
  price: number;
  MF: number;
  productId: string;
  factoryId: string;
  allowPickup: boolean;
  allowFactoryShipping: boolean;
  hasFactoryAddress: boolean;
};

type ShippingMode = "pickup" | "factory" | "platform";

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function ProductPurchaseClient({
  price,
  MF,
  productId,
  factoryId,
  allowPickup,
  allowFactoryShipping,
  hasFactoryAddress,
}: Props) {
  const [qty, setQty] = useState(1);
  const isFraccionado = qty < MF;

  /* ─── Shipping state ─── */
  const [selectedShipping, setSelectedShipping] = useState<ShippingMode>(() => {
    if (allowPickup) return "pickup";
    if (allowFactoryShipping) return "factory";
    return "platform";
  });
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingKm, setShippingKm] = useState<number | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);

  /* ─── MercadoPago status ─── */
  const [mpConnected, setMpConnected] = useState<boolean | null>(null);
  const [loadingMPStatus, setLoadingMPStatus] = useState(true);

  /* ─── Reserva flow ─── */
  const [reserving, setReserving] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const usesReserveFlow = isFraccionado && selectedShipping === "platform";

  // ✅ NUEVO: porcentaje real de comisión del usuario (se actualiza desde la API)
  const [commissionRate, setCommissionRate] = useState<number>(12); // default 12% mientras carga

  /* ─── Chequeo MP ─── */
  useEffect(() => {
    async function checkFactoryMPStatus() {
      setLoadingMPStatus(true);
      try {
        if (!factoryId) {
          setMpConnected(false);
          return;
        }
        const mpRes = await fetch(
          `/api/manufacturers/mp-status-public?factoryId=${factoryId}`
        );
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
  }, [factoryId]);

  /* ─── Cálculo de envío fraccionado (plataforma) ─── */
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
      setShippingKm(typeof data.km === "number" ? data.km : null);
    } catch (err) {
      console.error("Error envío plataforma:", err);
      setSelectedShipping("platform");
      setShippingCost(0);
      setShippingKm(null);
    } finally {
      setLoadingShipping(false);
    }
  }, [productId]);

  /* ─── Cálculo de envío directo (fábrica) ─── */
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
          setShippingKm(typeof data.km === "number" ? data.km : null);
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

  /* ─── Totales ─── */
  const productSubtotal = price * qty;
  // ✅ CORREGIDO: usa el porcentaje real del usuario en vez de 0.12 hardcodeado
  const commission = isFraccionado ? Math.round(productSubtotal * (commissionRate / 100)) : 0;
  const totalToCharge = useMemo(
    () => productSubtotal + commission + shippingCost,
    [productSubtotal, commission, shippingCost]
  );

  /* ─── ¿Puede comprar? ─── */
  const shippingNeedsAddress =
    selectedShipping === "factory" || selectedShipping === "platform";
  const blockedByAddress = shippingNeedsAddress && !hasFactoryAddress;

  /* ─── FLUJO RESERVA ─── */
  async function handleReserve() {
    if (blockedByAddress) return;
    if (mpConnected === false) {
      alert("⚠️ Este producto no está disponible para compra.\n\nEl fabricante aún no ha vinculado su cuenta de Mercado Pago.");
      return;
    }
    if (loadingMPStatus) {
      alert("⏳ Verificando disponibilidad...");
      return;
    }

    setReserving(true);
    setReserveError(null);

    try {
      const res = await fetch("/api/lots/fraccionado/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, qty, shippingMode: "platform" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.missingAddress) {
          setReserveError("Necesitás configurar tu dirección antes de reservar. Andá a tu perfil.");
        } else if (data.alreadyReserved) {
          setReserveError("Ya tenés una reserva activa para este producto. Revisá tu email cuando el lote cierre.");
        } else {
          setReserveError(data.error || "Error al reservar. Intentá de nuevo.");
        }
        return;
      }

      // ✅ NUEVO: guardar el commissionRate real devuelto por la API
      if (typeof data.commissionRate === "number") {
        setCommissionRate(data.commissionRate);
      }

      setReserved(true);
    } catch (err) {
      console.error("Error reservando:", err);
      setReserveError("Error de conexión. Intentá de nuevo.");
    } finally {
      setReserving(false);
    }
  }

  /* ─── FLUJO PAGO ─── */
  async function handleCheckout() {
    if (blockedByAddress) return;
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

  /* ─── RENDER: confirmación de reserva ─── */
  if (reserved) {
    return (
      <div className="border rounded-xl p-6 mt-8 bg-white shadow">
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-bold text-green-800 mb-2">
            ¡Lugar reservado!
          </h3>
          <p className="text-sm text-green-700">
            Estamos buscando más compradores en tu zona para dividir el envío.
            Cuando el lote alcance el mínimo, te mandamos un email con el precio
            final y el link de pago.
          </p>
          <p className="text-xs text-green-600 mt-3">
            El envío estimado es{" "}
            <strong>${formatNumber(shippingCost)}</strong> si pagás solo. Si
            se suman más personas de tu zona, ese precio baja.
          </p>
        </div>
      </div>
    );
  }

  /* ─── RENDER NORMAL ─── */
  return (
    <div className="border rounded-xl p-6 mt-8 bg-white shadow">

      {/* ⚠️ MP desconectado */}
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

      {/* ⚠️ Sin dirección del fabricante */}
      {!hasFactoryAddress && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📍</div>
            <div>
              <p className="font-semibold text-amber-900 mb-1">
                Compra no disponible momentáneamente
              </p>
              <p className="text-sm text-amber-700">
                El fabricante aún no configuró su dirección.
                No es posible calcular el envío ni procesar la compra hasta que lo haga.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CANTIDAD */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Cantidad</label>
        <input
          type="number"
          className="border rounded px-3 py-2 w-full"
          value={qty}
          onChange={(e) => {
            setQty(Math.max(1, Number(e.target.value)));
            setReserved(false);
            setReserveError(null);
          }}
          min={1}
        />
        <p className="text-xs text-gray-500 mt-1">
          Mínimo de fábrica: {MF} unidades
        </p>
      </div>

      {/* OPCIONES DE ENTREGA */}
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Opciones de entrega:</p>

        {allowPickup && (
          <label className="block mb-1">
            <input
              type="radio"
              name="shipping"
              checked={selectedShipping === "pickup"}
              onChange={() => {
                setSelectedShipping("pickup");
                setShippingCost(0);
                setShippingKm(null);
                setReserved(false);
                setReserveError(null);
              }}
              disabled={mpConnected === false}
            />
            <span className="ml-2">Retiro en fábrica (Gratis)</span>
          </label>
        )}

        {isFraccionado && (
          <label className="block mt-1">
            <input
              type="radio"
              name="shipping"
              checked={selectedShipping === "platform"}
              onChange={() => {
                calculatePlatformShipping();
                setReserved(false);
                setReserveError(null);
              }}
              disabled={mpConnected === false}
            />
            <span className="ml-2">
              {loadingShipping ? (
                "Calculando envío..."
              ) : (
                <>
                  Envío por plataforma: ${formatNumber(shippingCost)}
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

        {!isFraccionado && allowFactoryShipping && (
          <label className="block mt-1">
            <input
              type="radio"
              name="shipping"
              checked={selectedShipping === "factory"}
              onChange={() => setSelectedShipping("factory")}
              disabled={mpConnected === false}
            />
            <span className="ml-2">
              {loadingShipping ? (
                "Calculando envío..."
              ) : (
                <>
                  Envío por fábrica: ${formatNumber(shippingCost)}
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

        {!isFraccionado && !allowFactoryShipping && allowPickup && (
          <p className="text-xs text-gray-500 mt-2 italic">
            * Este producto solo admite retiro en fábrica para pedidos directos.
          </p>
        )}
      </div>

      {/* RESUMEN DE COSTOS */}
      <div className="border rounded p-4 text-sm mb-4 bg-gray-50">
        <p>Subtotal producto: $ {formatNumber(productSubtotal)}</p>
        {commission > 0 && (
          <p>Comisión ({commissionRate}%): $ {formatNumber(commission)}</p>
        )}
        <p>Envío: $ {formatNumber(shippingCost)}</p>
        <p className="font-semibold mt-2 text-base">
          Total: $ {formatNumber(totalToCharge)}
        </p>
      </div>

      {/* AVISO: fraccionado + plataforma */}
      {usesReserveFlow && !loadingShipping && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>💡 El envío podría ser menor.</strong> Buscamos otros
            compradores en tu zona para dividir el costo. Si se suman, pagás
            menos de{" "}
            <strong>${formatNumber(shippingCost)}</strong>.
            El precio final lo ves en el email cuando el lote cierre.
          </p>
        </div>
      )}

      {/* Error de reserva */}
      {reserveError && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">{reserveError}</p>
          {reserveError.includes("dirección") && (
            
             <a href="/dashboard/pedidos-fraccionados/perfil"
              className="text-sm font-semibold text-red-800 underline mt-1 block"
            >
              Ir a configurar dirección
            </a>
          )}
        </div>
      )}

      {/* BOTÓN: Reservar o Pagar */}
      {usesReserveFlow ? (
        <button
          onClick={handleReserve}
          disabled={
            loadingMPStatus ||
            mpConnected === false ||
            reserving ||
            loadingShipping ||
            blockedByAddress
          }
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reserving
            ? "Reservando..."
            : loadingMPStatus
            ? "Verificando disponibilidad..."
            : blockedByAddress
            ? "No disponible — el fabricante no configuró su dirección"
            : mpConnected === false
            ? "Producto no disponible"
            : "Reservar tu lugar — te avisamos cuando cierre el lote"}
        </button>
      ) : (
        <button
          onClick={handleCheckout}
          disabled={
            loadingMPStatus ||
            mpConnected === false ||
            blockedByAddress
          }
          className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMPStatus
            ? "Verificando disponibilidad..."
            : blockedByAddress
            ? "No disponible — el fabricante no configuró su dirección"
            : mpConnected === false
            ? "Producto no disponible"
            : "Continuar al pago"}
        </button>
      )}
    </div>
  );
}