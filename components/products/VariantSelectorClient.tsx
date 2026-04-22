"use client";

// components/products/VariantSelectorClient.tsx

import { useState } from "react";
import ProductPurchaseClient from "./ProductPurchaseClient";

// ── Tipos nuevos ──────────────────────────────────────────────────────────────
interface PurchaseFormat {
  unitLabel: string;
  unitsPerPack: number;
  price: number;
  colors?: string[];
}

interface ProductMinimum {
  type: "quantity" | "amount";
  value: number;
  formats: PurchaseFormat[];
}

// ── Tipo legacy (backward compat) ────────────────────────────────────────────
interface LegacyVariant {
  unitLabel: string;
  price: number;
  minimumOrder: number;
  isBase: boolean;
}

interface Props {
  minimums?: ProductMinimum[];   // nueva estructura
  allVariants: LegacyVariant[];  // estructura legacy (fallback)
  progressData: any;
  productId: string;
  productName: string;
  factoryId: string;
  allowPickup: boolean;
  allowFactoryShipping: boolean;
  hasFactoryAddress: boolean;
  noShipping: boolean;
  userId?: string;
}

function extractUnits(unitLabel: string): number {
  const s = unitLabel.toLowerCase().trim();
  if (/^(unidad|und|ud\.?|individual|suelto|pieza|pza\.?|c\/u|x1|1\s*u)$/.test(s)) return 1;
  if (/media\s*docena|1\/2\s*doc/.test(s)) return 6;
  if (/docena/.test(s)) return 12;
  const packMatch = s.match(/(?:pack|caja|x|×|bolsa|fardo|atado|por|de)\s*(\d+)/);
  if (packMatch) {
    const n = parseInt(packMatch[1]);
    if (n > 1 && n <= 10000) return n;
  }
  const nums = [...s.matchAll(/\d+/g)].map(m => parseInt(m[0]));
  const big = nums.filter(n => n > 1 && n <= 10000);
  if (big.length > 0) return Math.max(...big);
  return 1;
}

function formatMinimumLabel(type: "quantity" | "amount", value: number): string {
  if (type === "amount") return `Mínimo $${value.toLocaleString("es-AR")}`;
  return `Mínimo ${value.toLocaleString("es-AR")} uds.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO NUEVO: producto con `minimums`
// ─────────────────────────────────────────────────────────────────────────────
function NewMinimumSelector({
  minimums,
  progressData,
  productId,
  productName,
  factoryId,
  allowPickup,
  allowFactoryShipping,
  hasFactoryAddress,
  noShipping,
  userId,
}: { minimums: ProductMinimum[] } & Omit<Props, "minimums" | "allVariants">) {
  const [selectedMinIdx, setSelectedMinIdx] = useState(0);
  const [selectedFmtIdx, setSelectedFmtIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const selectedMin = minimums[selectedMinIdx] ?? minimums[0];
  const selectedFmt = selectedMin.formats[selectedFmtIdx] ?? selectedMin.formats[0];

  const price = selectedFmt.price;
  const minimumValue = selectedMin.value;
  const minimumType = selectedMin.type;
  const unitLabel = selectedFmt.unitLabel;
  const colors = selectedFmt.colors ?? [];

  // Resetear color cuando cambia la presentación
  const handleSelectFormat = (mi: number, fi: number) => {
    setSelectedMinIdx(mi);
    setSelectedFmtIdx(fi);
    setSelectedColor(null);
  };

  const fastestMinIndices = new Set<number>();
  if (minimums.length >= 2) {
    const count = minimums.length > 2 ? 2 : 1;
    [...minimums]
      .map((m, i) => ({ i, value: m.value }))
      .sort((a, b) => a.value - b.value)
      .slice(0, count)
      .forEach(({ i }) => fastestMinIndices.add(i));
  }

  const allFormats = minimums.flatMap((m, mi) =>
    m.formats.map((f, fi) => ({ mi, fi, pricePerUnit: f.price / f.unitsPerPack, unitsPerPack: f.unitsPerPack }))
  );
  const hasAnyPack = allFormats.some(f => f.unitsPerPack > 1);
  const eligibleFormats = hasAnyPack ? allFormats.filter(f => f.unitsPerPack > 1) : allFormats;
  let cheapestFmt: { mi: number; fi: number } | null = null;
  if (eligibleFormats.length > 0) {
    const best = eligibleFormats.reduce((a, b) => a.pricePerUnit <= b.pricePerUnit ? a : b);
    cheapestFmt = { mi: best.mi, fi: best.fi };
  }

  const effectiveMF = minimumType === "amount"
    ? (price > 0 ? Math.ceil(minimumValue / price) : 1)
    : minimumValue;

  return (
    <>
      {/* SECCIONES DE MÍNIMOS */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
          Opciones de compra
        </p>

        <div className="space-y-3">
          {minimums.map((m, mi) => {
            const isFastestMin = fastestMinIndices.has(mi);

            return (
              <div
                key={mi}
                className={`rounded-xl border p-3 transition-all cursor-default ${
                  selectedMinIdx === mi
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {formatMinimumLabel(m.type, m.value)}
                  </span>
                  {isFastestMin && (
                    <span className="bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
                      ⚡ Llena más rápido
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {m.formats.map((f, fi) => {
                    const isSelectedFmt = selectedMinIdx === mi && selectedFmtIdx === fi;
                    const isCheapest = cheapestFmt?.mi === mi && cheapestFmt?.fi === fi;

                    return (
                      <div key={fi} className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleSelectFormat(mi, fi)}
                          className={`
                            px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150
                            ${isSelectedFmt
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : isCheapest
                                ? "bg-white text-gray-700 border-amber-400 hover:border-amber-500 hover:text-amber-700"
                                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                            }
                          `}
                        >
                          {f.unitLabel}
                          <span className={`ml-1.5 text-xs ${isSelectedFmt ? "text-blue-100" : "text-gray-400"}`}>
                            ${f.price.toLocaleString("es-AR")}
                          </span>
                        </button>
                        {isCheapest && (
                          <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                            💲 Mejor precio/ud
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ SELECTOR DE COLORES */}
      {colors.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
            Color
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(isSelected ? null : color)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 ${
                    isSelected
                      ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:text-gray-900"
                  }`}
                >
                  {color}
                </button>
              );
            })}
          </div>
          {!selectedColor && (
            <p className="text-xs text-gray-400 mt-1.5">Seleccioná un color para tu pedido</p>
          )}
        </div>
      )}

      {/* PRECIO DE LA SELECCIÓN */}
      <div className="mb-3">
        <p className="text-3xl font-light text-gray-900 leading-none">
          ${price.toLocaleString("es-AR")}
          <span className="text-base font-normal text-gray-500 ml-1">/ {unitLabel}</span>
        </p>
        {selectedFmt.unitsPerPack > 1 && (
          <p className="text-xs text-gray-400 mt-1">
            ${Math.round(price / selectedFmt.unitsPerPack).toLocaleString("es-AR")} por unidad
          </p>
        )}
        {selectedColor && (
          <p className="text-xs text-gray-500 mt-1">
            Color seleccionado: <strong>{selectedColor}</strong>
          </p>
        )}
      </div>

      {/* PEDIDO MÍNIMO + PRECIO TOTAL */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
            {minimumType === "amount" ? "Compra mínima" : "Pedido mínimo"}
          </p>
          {minimumType === "amount" ? (
            <>
              <p className="text-xl font-semibold text-gray-900">${minimumValue.toLocaleString("es-AR")}</p>
              <p className="text-xs text-gray-500 mt-0.5">en pesos</p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold text-gray-900">{minimumValue} uds.</p>
              <p className="text-xs text-gray-500 mt-0.5">{unitLabel} c/u</p>
            </>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Precio mínimo total</p>
          <p className="text-xl font-semibold text-gray-900">
            ${(price * effectiveMF).toLocaleString("es-AR")}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {effectiveMF} × ${price.toLocaleString("es-AR")}
          </p>
        </div>
      </div>

      {/* PROGRESO FRACCIONADO */}
      {progressData && progressData.accumulatedQty > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <h3 className="font-semibold text-xs mb-1.5 text-blue-900">📦 Progreso Fraccionado</h3>
          <p className="text-xs text-gray-600 mb-2">
            {progressData.accumulatedQty} / {effectiveMF} unidades acumuladas
          </p>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((progressData.accumulatedQty / effectiveMF) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ✅ FIX: sin {userId && (...)} — siempre se renderiza, userId controla solo el botón */}
      <ProductPurchaseClient
        price={price}
        MF={effectiveMF}
        minimumType={minimumType}
        minimumValue={minimumValue}
        minimumIndex={selectedMinIdx}
        formatIndex={selectedFmtIdx}
        productId={productId}
        productName={productName}
        factoryId={factoryId}
        allowPickup={allowPickup}
        allowFactoryShipping={allowFactoryShipping}
        hasFactoryAddress={hasFactoryAddress}
        noShipping={noShipping}
        unitLabel={unitLabel || undefined}
        userId={userId}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO LEGACY: producto con `allVariants` (estructura antigua)
// ─────────────────────────────────────────────────────────────────────────────
function LegacyVariantSelector({
  allVariants,
  progressData,
  productId,
  productName,
  factoryId,
  allowPickup,
  allowFactoryShipping,
  hasFactoryAddress,
  noShipping,
  userId,
}: { allVariants: LegacyVariant[] } & Omit<Props, "minimums" | "allVariants">) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selected = allVariants[selectedIndex];
  const unitLabel = selected.unitLabel || null;
  const price = selected.price;
  const minimumOrder = selected.minimumOrder;

  const fastestLotIndices = new Set<number>();
  if (allVariants.length >= 2) {
    const count = allVariants.length > 2 ? 2 : 1;
    [...allVariants]
      .map((v, i) => ({ i, minimumOrder: v.minimumOrder }))
      .sort((a, b) => a.minimumOrder - b.minimumOrder)
      .slice(0, count)
      .forEach(({ i }) => fastestLotIndices.add(i));
  }

  const hasAnyPack = allVariants.some(v => extractUnits(v.unitLabel) > 1);
  const eligible = hasAnyPack
    ? allVariants.filter(v => extractUnits(v.unitLabel) > 1)
    : allVariants;
  const cheapestIdx = eligible.length > 0
    ? eligible.reduce((best, v) => {
        const bpu = v.price / extractUnits(v.unitLabel);
        const cBpu = best.price / extractUnits(best.unitLabel);
        return bpu < cBpu ? v : best;
      })
    : null;
  const cheapestPerUnitIndex = cheapestIdx ? allVariants.indexOf(cheapestIdx) : -1;

  return (
    <>
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
          Presentaciones disponibles
        </p>
        <div className="flex flex-wrap gap-3">
          {allVariants.map((v, i) => {
            const isSelected = i === selectedIndex;
            const label = v.unitLabel || "Base";
            const isFastest = fastestLotIndices.has(i);
            const isCheapest = i === cheapestPerUnitIndex;

            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setSelectedIndex(i)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150
                    ${isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : isFastest
                        ? "bg-white text-gray-700 border-green-500 hover:border-green-600"
                        : isCheapest
                          ? "bg-white text-gray-700 border-amber-400 hover:border-amber-500"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }
                  `}
                >
                  {label}
                  <span className={`ml-1.5 text-xs ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                   ${Math.round(v.price * 1.04).toLocaleString("es-AR")}
                  </span>
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  {isFastest && (
                    <span className="bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                      ⚡ Llena más rápido
                    </span>
                  )}
                  {isCheapest && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                      💲 Mejor precio/ud
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-3xl font-light text-gray-900 leading-none">
          ${price.toLocaleString("es-AR")}
          {unitLabel && <span className="text-base font-normal text-gray-500 ml-1">/ {unitLabel}</span>}
        </p>
        {unitLabel && <p className="text-xs text-gray-400 mt-1">precio por {unitLabel}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Pedido mínimo</p>
          <p className="text-xl font-semibold text-gray-900">{minimumOrder} uds.</p>
          {unitLabel && <p className="text-xs text-gray-500 mt-0.5">{unitLabel} c/u</p>}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Precio mínimo total</p>
          <p className="text-xl font-semibold text-gray-900">${(price * minimumOrder).toLocaleString("es-AR")}</p>
          <p className="text-xs text-gray-500 mt-0.5">{minimumOrder} × ${price.toLocaleString("es-AR")}</p>
        </div>
      </div>

      {progressData && progressData.accumulatedQty > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <h3 className="font-semibold text-xs mb-1.5 text-blue-900">📦 Progreso Fraccionado</h3>
          <p className="text-xs text-gray-600 mb-2">
            {progressData.accumulatedQty} / {minimumOrder} unidades acumuladas
            {unitLabel ? ` (${unitLabel} c/u)` : ""}
          </p>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((progressData.accumulatedQty / minimumOrder) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ✅ FIX: sin {userId && (...)} — siempre se renderiza, userId controla solo el botón */}
      <ProductPurchaseClient
        price={price}
        MF={minimumOrder}
        productId={productId}
        productName={productName}
        factoryId={factoryId}
        allowPickup={allowPickup}
        allowFactoryShipping={allowFactoryShipping}
        hasFactoryAddress={hasFactoryAddress}
        noShipping={noShipping}
        unitLabel={unitLabel || undefined}
        userId={userId}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL — delega al modo correcto
// ─────────────────────────────────────────────────────────────────────────────
export default function VariantSelectorClient(props: Props) {
  const { minimums, allVariants, ...rest } = props;

  if (minimums && minimums.length > 0) {
    return <NewMinimumSelector minimums={minimums} {...rest} />;
  }

  return <LegacyVariantSelector allVariants={allVariants} {...rest} />;
}