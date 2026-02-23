"use client";
// components/ShippingSimulatorSection.tsx — VERSIÓN FINAL

import { useEffect, useState } from "react";

interface ZoneGroup {
  postalCode: string;
  buyerCount: number;
  buyerNames: string[];
  groupShippingCost: number | null;
}

interface ApiResponse {
  shippingCostTotal: number | null;
  groups: ZoneGroup[];
  totalBuyers: number;
}

interface Props {
  productId: string;
}

function formatCompact(amount: number): string {
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString("es-AR")}`;
}

function formatFull(amount: number): string {
  return `$ ${amount.toLocaleString("es-AR")}`;
}

function formatNames(names: string[]): string {
  if (names.length === 0) return "Compradores";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} y ${last}`;
}

export default function ShippingSimulatorSection({ productId }: Props) {
  const [sliderValue, setSliderValue] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(
          `/api/lots/zone-companions?productId=${productId}`
        );
        if (!res.ok) {
          setApiError(true);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error cargando simulador:", err);
        setApiError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [productId]);

  if (loading) {
    return (
      <div className="border-t border-gray-100 pt-4">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (apiError) return null;

  if (!data?.shippingCostTotal) {
    return (
      <div className="border-t border-gray-100 pt-4">
        
        <h2 className="text-base font-bold text-gray-900 mb-2">
          Simulador: el envío cae a medida que se suman compradores
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            ⚠️ Para ver cuánto ahorrarías compartiendo el envío,{" "}
            
             <a href="/dashboard/pedidos-fraccionados/perfil"
              className="font-semibold underline hover:text-amber-900"
            >
              configurá tu dirección en tu perfil
            </a>
            . El cálculo se basa en la distancia desde la base logística hasta
            tu zona.
          </p>
        </div>
      </div>
    );
  }

  const shippingTotal = data.shippingCostTotal;
  const costPerBuyer = Math.round(shippingTotal / sliderValue);
  const savings = shippingTotal - costPerBuyer;
  const savingsPct =
    sliderValue > 1 && shippingTotal > 0
      ? Math.round((savings / shippingTotal) * 100)
      : 0;
  const barPercent = (costPerBuyer / shippingTotal) * 100;

  const tableValues = Array.from({ length: 8 }, (_, i) => ({
    n: i + 1,
    cost: Math.round(shippingTotal / (i + 1)),
  }));

  return (
    <div className="border-t border-gray-100 pt-4">

      {/* ENCABEZADO */}
      <div className="mb-3">
        <span className="inline-block bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-2">
          Paso 5
        </span>
        <h2 className="text-base font-bold text-gray-900">
          Simulador: el envío cae a medida que se suman compradores
        </h2>
        <p className="text-gray-500 text-xs mt-1">
          Arrastrá el slider para simular cuántos compradores de la misma zona
          se unen al cupo. El precio que ves es el del punto más lejano de tu
          zona, así quedan cubiertas todas las variaciones de distancia.
        </p>
      </div>

      {/* ZONA */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-gray-700">Zona:</span>
        <span className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white text-gray-800 font-medium">
          Tu zona de envío
        </span>
      </div>

      {/* CONTADOR */}
      <p className="text-xs font-semibold text-gray-800 mb-1.5">
        Compradores en la misma zona:{" "}
        <span className="text-orange-500 font-bold">{sliderValue}</span>
      </p>

      {/* SLIDER */}
      <input
        type="range"
        min={1}
        max={8}
        step={1}
        value={sliderValue}
        onChange={(e) => setSliderValue(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-1"
        style={{
          background: `linear-gradient(to right, #2563eb ${
            ((sliderValue - 1) / 7) * 100
          }%, #e5e7eb ${((sliderValue - 1) / 7) * 100}%)`,
          accentColor: "#2563eb",
        }}
      />
      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>1 (individual)</span>
        <span>8 (nodo barrial)</span>
      </div>

      {/* COSTO POR COMPRADOR */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Costo de envío por comprador
          </p>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              sliderValue === 1
                ? "bg-orange-100 text-orange-700"
                : "bg-orange-500 text-white"
            }`}
          >
            {sliderValue === 1 ? "Individual" : `${sliderValue} compradores`}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatFull(costPerBuyer)}
          </span>
          {sliderValue > 1 && (
            <span className="text-base text-gray-400 line-through">
              {formatFull(shippingTotal)}
            </span>
          )}
        </div>

        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: `${barPercent}%`,
              backgroundColor: sliderValue === 1 ? "#1e3a8a" : "#f97316",
            }}
          />
        </div>

        {sliderValue > 1 && savings > 0 && (
          <p className="text-green-600 text-xs font-semibold">
            💚 Ahorros {formatFull(savings)} vs envío individual ({savingsPct}% menos)
          </p>
        )}
      </div>

      {/* TABLA DE AHORRO */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
          Tabla de ahorro completa — Tu zona
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {tableValues.map(({ n, cost }) => {
            const isActive = n === sliderValue;
            return (
              <button
                key={n}
                onClick={() => setSliderValue(n)}
                className={`rounded-lg p-2 text-center transition-all cursor-pointer border-2 ${
                  isActive
                    ? "bg-gray-900 text-white border-orange-500 shadow-md"
                    : "bg-green-50 text-gray-800 border-transparent hover:border-gray-300"
                }`}
              >
                <p className={`text-xs font-medium ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                  {n} comp.
                </p>
                <p className={`text-xs font-bold mt-0.5 ${isActive ? "text-white" : "text-gray-800"}`}>
                  {formatCompact(cost)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* COMPRADORES REALES DEL LOTE */}
      {data.groups.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-800 mb-1">
            👥 Compradores en el lote actual
          </p>
          <p className="text-xs text-blue-600 mb-3">
            Estas personas ya se unieron. El precio que divide cada zona es el
            del punto más lejano de esa zona para cubrir toda el área.
          </p>

          {data.groups.map((group) => {
            const groupCost = group.groupShippingCost ?? shippingTotal;
            const costEach = Math.round(groupCost / group.buyerCount);
            const namesText = formatNames(group.buyerNames);

            return (
              <div
                key={group.postalCode}
                className="bg-white rounded-lg p-3 mb-2 last:mb-0 border border-blue-100"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-800">
                    📍 Zona {group.postalCode}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                    {group.buyerCount}{" "}
                    {group.buyerCount === 1 ? "comprador" : "compradores"}
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-1.5">
                  <strong className="text-gray-800">{namesText}</strong> de{" "}
                  <strong className="text-gray-800">{group.postalCode}</strong>{" "}
                  {group.buyerCount > 1
                    ? "se unieron para compartir el envío"
                    : "está esperando compañeros de zona"}
                </p>

                {group.buyerCount > 1 && group.groupShippingCost && (
                  <div className="bg-green-50 rounded-lg p-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-500">Envío de referencia zona:</span>
                      <span className="font-semibold text-gray-700">
                        {formatFull(group.groupShippingCost)}
                      </span>
                      <span className="text-gray-400">÷ {group.buyerCount} =</span>
                      <span className="font-bold text-green-700">
                        {formatFull(costEach)} por persona
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      * Se usa el precio del punto más lejano de la zona para
                      cubrir todas las ubicaciones del grupo.
                    </p>
                  </div>
                )}

                {group.buyerCount === 1 && (
                  <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                    Si otra persona de {group.postalCode} se suma, cada uno
                    pagaría aprox.{" "}
                    <strong>{formatFull(Math.round(groupCost / 2))}</strong>{" "}
                    de envío.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.totalBuyers > 0 && data.groups.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs text-blue-700">
            👥{" "}
            <strong>
              {data.totalBuyers}{" "}
              {data.totalBuyers === 1 ? "persona" : "personas"}
            </strong>{" "}
            {data.totalBuyers === 1 ? "ya se unió" : "ya se unieron"} al lote
            de este producto.
          </p>
        </div>
      )}
    </div>
  );
}