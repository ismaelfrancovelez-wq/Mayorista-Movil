"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PaymentMethod } from "../../../lib/pricing/commission";

type Props = {
  reservationId: string;
  productName: string;
  qty: number;
  productSubtotal: number;
  shippingCostFinal: number;
  totalFinal: number;
  shippingMode: string;
  retailerName: string;
  paymentMethod: PaymentMethod;
  methodLabel: string;
  surchargePercent: number;
  finalPriceWithSurcharge: number;
  surchargeAmount: number;
};

const QR_POLL_INTERVAL_MS = 3000;
const QR_EXPIRE_SECONDS   = 600;

export default function PagarReservaClient({
  reservationId,
  productName,
  qty,
  productSubtotal,
  shippingCostFinal,
  totalFinal,
  shippingMode,
  retailerName,
  paymentMethod,
  methodLabel,
  surchargePercent,
  finalPriceWithSurcharge,
  surchargeAmount,
}: Props) {
  const isPickup    = shippingMode === "pickup";
  const isQRMethod  = paymentMethod.startsWith("qr_");

  // ── Estado QR ──
  const [qrImage,       setQrImage]       = useState<string | null>(null);
  const [qrAmount,      setQrAmount]      = useState<number>(finalPriceWithSurcharge);
  const [qrTimeLeft,    setQrTimeLeft]    = useState<number>(QR_EXPIRE_SECONDS);
  const [qrLoading,     setQrLoading]     = useState(false);
  const [qrPaid,        setQrPaid]        = useState(false);

  // ── Estado Checkout ──
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpieza de timers al desmontar
  useEffect(() => () => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── Generar QR ──
  async function handleGenerateQR() {
    setQrLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/qr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error generando QR");
        return;
      }

      setQrImage(data.qr_image);
      setQrAmount(data.amount);
      setQrTimeLeft(data.expiresSeconds ?? QR_EXPIRE_SECONDS);

      startPolling();
      startCountdown(data.expiresSeconds ?? QR_EXPIRE_SECONDS);
    } catch {
      setError("Error de conexión generando el QR");
    } finally {
      setQrLoading(false);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/payments/qr/status?reservationId=${reservationId}`);
        const data = await res.json();
        if (data.paid) {
          clearInterval(pollRef.current!);
          clearInterval(timerRef.current!);
          setQrPaid(true);
        }
      } catch { /* ignorar errores de red en el poll */ }
    }, QR_POLL_INTERVAL_MS);
  }

  function startCountdown(seconds: number) {
    setQrTimeLeft(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setQrTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          clearInterval(pollRef.current!);
          setQrImage(null); // QR expirado
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  // ── Pago Checkout ──
  async function handleCheckoutPay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/transferencia/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error iniciando pago");
        return;
      }
      if (data.init_point) window.location.href = data.init_point;
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  // ── Pantalla QR pagado ──
  if (qrPaid) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">¡Pago confirmado!</h1>
          <p className="text-gray-600 mb-6">
            Tu pago de <strong>${qrAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong> fue acreditado.
            Recibirás un email con los detalles.
          </p>
          <Link
            href="/explorar"
            className="inline-block bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition"
          >
            Volver a explorar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/explorar"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4 text-sm"
        >
          ← Volver a explorar
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">¡Tu lote cerró!</h1>
          <p className="text-sm text-gray-600">
            Hola <strong>{retailerName}</strong>, ya podés completar tu pago.
          </p>
        </div>

        {/* Resumen del pedido */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📦 Tu pedido</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Producto:</span>
              <span className="font-medium">{productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cantidad:</span>
              <span className="font-medium">{qty} unidades</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${productSubtotal.toLocaleString("es-AR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Envío:</span>
              <span className="font-medium">
                {isPickup ? "Retiro en fábrica (gratis)" : `$${shippingCostFinal.toLocaleString("es-AR")}`}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-600">Subtotal limpio:</span>
              <span className="font-medium">${totalFinal.toLocaleString("es-AR")}</span>
            </div>
          </div>
        </div>

        {/* Método y total */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">💳 Método elegido</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-blue-900">{methodLabel}</p>
            <p className="text-xs text-blue-700 mt-1">
              Recargo {surchargePercent}% —{" "}
              ${surchargeAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-base font-semibold text-gray-900">Total a pagar:</span>
            <span className="text-2xl font-semibold text-blue-600">
              ${finalPriceWithSurcharge.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ── FLUJO QR ── */}
        {isQRMethod && (
          <div className="bg-white rounded-2xl shadow p-6 mb-4">
            {!qrImage ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Se va a generar un QR único para tu pago. Escanealo con cualquier
                  app bancaria (Mercado Pago, Cuenta DNI, Modo, BNA+, Ualá, etc.).
                </p>
                <button
                  onClick={handleGenerateQR}
                  disabled={qrLoading}
                  className="w-full bg-black text-white py-4 rounded-xl text-base font-medium hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {qrLoading ? "Generando QR..." : `Generar QR — $${finalPriceWithSurcharge.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium text-gray-700">
                  Escaneá con tu app bancaria o billetera
                </p>

                {/* QR image */}
                <div className="border-4 border-gray-900 rounded-xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImage} alt="QR de pago" width={240} height={240} />
                </div>

                {/* Monto */}
                <p className="text-2xl font-bold text-gray-900">
                  ${qrAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>

                {/* Countdown */}
                <div className={`text-sm font-medium ${qrTimeLeft < 60 ? "text-red-600" : "text-gray-500"}`}>
                  {qrTimeLeft > 0
                    ? `⏳ Expira en ${formatTime(qrTimeLeft)}`
                    : "⚠️ QR expirado — generá uno nuevo"}
                </div>

                {/* Spinner de espera */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Esperando confirmación de pago...
                </div>

                {/* Regenerar si expiró */}
                {qrTimeLeft === 0 && (
                  <button
                    onClick={handleGenerateQR}
                    className="text-sm text-blue-600 underline"
                  >
                    Generar nuevo QR
                  </button>
                )}

                {/* Logos de billeteras aceptadas */}
                <p className="text-xs text-gray-400 text-center">
                  Compatible con MP · Cuenta DNI · Modo · BNA+ · Ualá · cualquier billetera CVU
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── FLUJO CHECKOUT ── */}
        {!isQRMethod && (
          <button
            onClick={handleCheckoutPay}
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl text-base font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Iniciando pago..."
              : `Pagar $${finalPriceWithSurcharge.toLocaleString("es-AR", { minimumFractionDigits: 2 })} →`}
          </button>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-300 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}