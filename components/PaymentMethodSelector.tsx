"use client";

import { useState } from "react";
import {
  PaymentMethod,
  PaymentChannel,
  PAYMENT_METHODS_META,
  PAYMENT_METHOD_COMMISSIONS,
  getPriceBreakdown,
  PriceBreakdown,
} from "../lib/pricing/commission";

type Props = {
  basePrice: number;
  enabledMethods: PaymentMethod[];
  onMethodSelected: (method: PaymentMethod, finalPrice: number) => void;
  /** Texto del botón final. Default: "Pagar" */
  ctaLabel?: string;
  /** Loading state externo (cuando el caller está procesando) */
  loading?: boolean;
};

const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  qr: "QR",
  prometeo: "Transferencia tradicional",
  checkout: "Checkout MP",
};

const CHANNEL_DESCRIPTIONS: Record<PaymentChannel, string> = {
  qr: "Escaneá el QR con tu app bancaria. Cualquier billetera (MP, Cuenta DNI, Modo, BNA+, Ualá).",
  prometeo: "Transferí desde tu homebanking al CBU de MayoristaMovil.",
  checkout: "Pagá con Mercado Pago: tarjeta de crédito, débito o saldo.",
};

const CHANNEL_ICONS: Record<PaymentChannel, string> = {
  qr: "📱",
  prometeo: "🏛️",
  checkout: "💳",
};

const CHANNEL_BADGES: Record<PaymentChannel, { label: string; color: string } | null> = {
  qr: { label: "Más barato", color: "bg-green-100 text-green-800" },
  prometeo: null,
  checkout: { label: "Flexible", color: "bg-amber-100 text-amber-800" },
};

export default function PaymentMethodSelector({
  basePrice,
  enabledMethods,
  onMethodSelected,
  ctaLabel = "Pagar",
  loading = false,
}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<PaymentChannel | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Filtrar métodos habilitados por canal
  const methodsByChannel: Record<PaymentChannel, PaymentMethod[]> = {
    qr: [],
    prometeo: [],
    checkout: [],
  };
  enabledMethods.forEach((m) => {
    const meta = PAYMENT_METHODS_META[m];
    methodsByChannel[meta.channel].push(m);
  });

  // Solo mostrar canales con al menos 1 método activo
  const activeChannels: PaymentChannel[] = (["qr", "prometeo", "checkout"] as PaymentChannel[])
    .filter((ch) => methodsByChannel[ch].length > 0);

  // Para cada canal, "precio desde" = el método más barato del canal
  function getCheapestMethod(channel: PaymentChannel): PaymentMethod {
    const methods = methodsByChannel[channel];
    return methods.reduce((a, b) =>
      PAYMENT_METHOD_COMMISSIONS[a] <= PAYMENT_METHOD_COMMISSIONS[b] ? a : b
    );
  }

  // ─────────── NIVEL 1: vista inicial con cards ───────────
  if (!selectedChannel) {
    return (
      <div className="space-y-3">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">Precio del producto</p>
            <p className="text-2xl font-light text-gray-900">
              ${basePrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-xs text-gray-400">Elegí cómo pagar</p>
        </div>

        <div className={`grid gap-3 ${activeChannels.length === 3 ? "md:grid-cols-3" : activeChannels.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          {activeChannels.map((channel) => {
            const cheapest = getCheapestMethod(channel);
            const breakdown = getPriceBreakdown(basePrice, cheapest);
            const badge = CHANNEL_BADGES[channel];
            const isPrometeo = channel === "prometeo";

            return (
              <button
                key={channel}
                onClick={() => {
                  setSelectedChannel(channel);
                  setSelectedMethod(cheapest);
                }}
                className={`text-left p-4 rounded-xl bg-white transition hover:border-gray-400 flex flex-col gap-2 min-h-[160px] ${
                  isPrometeo
                    ? "border-2 border-blue-500"
                    : "border border-gray-200"
                } relative`}
              >
                {isPrometeo && (
                  <span className="absolute -top-2.5 left-3 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    Recomendado
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{CHANNEL_ICONS[channel]}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {CHANNEL_LABELS[channel]}
                  </span>
                </div>

                <div className="mt-1">
                  {channel === "prometeo" ? (
                    <p className="text-xs text-gray-500">
                      Recargo {breakdown.meta.surchargePercent}%
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Desde</p>
                  )}
                  <p className="text-xl font-semibold text-gray-900 mt-0.5">
                    ${breakdown.finalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                  {channel !== "prometeo" && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      recargo {breakdown.meta.surchargePercent}%
                    </p>
                  )}
                </div>

                {channel === "prometeo" && (
                  <p className="text-xs text-gray-500 mt-auto flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirmación en 5 min
                  </p>
                )}

                {badge && (
                  <span className={`inline-block self-start text-xs px-2 py-0.5 rounded-full font-medium ${badge.color} mt-auto`}>
                    {badge.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────── NIVEL 2: sub-opciones del canal elegido ───────────
  const channelMethods = methodsByChannel[selectedChannel];
  const cheapestInChannel = getCheapestMethod(selectedChannel);
  const selectedBreakdown = selectedMethod ? getPriceBreakdown(basePrice, selectedMethod) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            setSelectedChannel(null);
            setSelectedMethod(null);
          }}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <p className="text-sm font-medium text-gray-900">
          Pagar con {CHANNEL_LABELS[selectedChannel]} — elegí el medio
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {channelMethods.map((method) => {
          const breakdown = getPriceBreakdown(basePrice, method);
          const isSelected = selectedMethod === method;
          const isCheapest = method === cheapestInChannel;

          return (
            <div
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                isSelected
                  ? "border-2 border-blue-500 bg-blue-50"
                  : "border border-gray-200 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 relative ${
                    isSelected ? "border-blue-600" : "border-gray-400"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute inset-1 rounded-full bg-blue-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {breakdown.meta.label.replace(/^[^—]+—\s*/, "")}
                  </p>
                  {isCheapest && channelMethods.length > 1 && (
                    <p className="text-xs text-green-700 font-medium mt-0.5">Más barato</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                  ${breakdown.finalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  recargo {breakdown.meta.surchargePercent}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-xs text-gray-500 underline hover:text-gray-900 transition"
        >
          {showBreakdown ? "Ocultar desglose" : "Ver desglose completo"}
        </button>
        <button
          onClick={() => {
            if (selectedMethod && selectedBreakdown) {
              onMethodSelected(selectedMethod, selectedBreakdown.finalPrice);
            }
          }}
          disabled={!selectedMethod || loading}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Procesando..."
            : selectedBreakdown
            ? `${ctaLabel} $${selectedBreakdown.finalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })} →`
            : ctaLabel}
        </button>
      </div>

      {showBreakdown && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Desglose completo sobre ${basePrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
          <div className="space-y-1">
            <div className="grid grid-cols-[1.5fr_70px_70px_90px] gap-2 text-xs font-medium text-gray-500 pb-1 border-b border-gray-200">
              <span>Método</span>
              <span className="text-right">Comisión</span>
              <span className="text-right">+IVA</span>
              <span className="text-right">Recargo</span>
            </div>
            {enabledMethods.map((m) => {
              const b = getPriceBreakdown(basePrice, m);
              const baseRate = PAYMENT_METHOD_COMMISSIONS[m] / 1.21;
              const ivaRate = PAYMENT_METHOD_COMMISSIONS[m] - baseRate;
              return (
                <div
                  key={m}
                  className="grid grid-cols-[1.5fr_70px_70px_90px] gap-2 text-xs text-gray-700 py-1"
                >
                  <span className="truncate">{b.meta.label}</span>
                  <span className="text-right tabular-nums">{(baseRate * 100).toFixed(2)}%</span>
                  <span className="text-right tabular-nums">{(ivaRate * 100).toFixed(2)}%</span>
                  <span className="text-right tabular-nums">
                    ${b.surchargeAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}