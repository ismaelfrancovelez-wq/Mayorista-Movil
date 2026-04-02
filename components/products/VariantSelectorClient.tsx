"use client";

// components/products/VariantSelectorClient.tsx
// ✅ NUEVO: muestra pills de variantes, actualiza precio/mínimo al seleccionar

import { useState } from "react";
import ProductPurchaseClient from "./ProductPurchaseClient";

interface Variant {
  unitLabel: string;
  price: number;
  minimumOrder: number;
  isBase: boolean;
}

interface Props {
  allVariants: Variant[];
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

/** Extrae la cantidad numérica de un unitLabel. Ej: "Pack 6 unidades" → 6 */
function extractUnits(unitLabel: string): number {
  const match = unitLabel.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

export default function VariantSelectorClient({
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
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selected = allVariants[selectedIndex];
  const unitLabel = selected.unitLabel || null;
  const price = selected.price;
  const minimumOrder = selected.minimumOrder;

  // Badge "llena el lote más rápido": variante con mayor minimumOrder
  const fastestLotIndex = allVariants.reduce((bestIdx, v, i) =>
    v.minimumOrder > allVariants[bestIdx].minimumOrder ? i : bestIdx, 0);

  // Badge "mejor precio/unidad": solo si hay 2+ variantes, la de menor precio/unidad
  const cheapestPerUnitIndex = allVariants.length >= 2
    ? allVariants.reduce((bestIdx, v, i) => {
        const units = extractUnits(v.unitLabel);
        const bestUnits = extractUnits(allVariants[bestIdx].unitLabel);
        return (v.price / units) < (allVariants[bestIdx].price / bestUnits) ? i : bestIdx;
      }, 0)
    : -1;

  return (
    <>
      {/* PILLS DE VARIANTES */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
          Presentaciones disponibles
        </p>
        <div className="flex flex-wrap gap-2">
          {allVariants.map((v, i) => {
            const isSelected = i === selectedIndex;
            const label = v.unitLabel || "Base";
            const isFastest = i === fastestLotIndex;
            const isCheapest = i === cheapestPerUnitIndex && i !== fastestLotIndex;
            return (
              <div key={i} className="flex flex-col gap-1">
                {isFastest && (
                  <span className="bg-green-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded self-start leading-none">
                    ⚡ Llena el lote más rápido
                  </span>
                )}
                {isCheapest && (
                  <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded self-start leading-none">
                    💲 Mejor precio/unidad
                  </span>
                )}
                <button
                  onClick={() => setSelectedIndex(i)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150
                    ${isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                    }
                  `}
                >
                  {label}
                  <span className={`ml-1.5 text-xs ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                    ${v.price.toLocaleString("es-AR")}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRECIO de la variante seleccionada */}
      <div className="mb-3">
        <p className="text-3xl font-light text-gray-900 leading-none">
          ${price.toLocaleString("es-AR")}
          {unitLabel && (
            <span className="text-base font-normal text-gray-500 ml-1">/ {unitLabel}</span>
          )}
        </p>
        {unitLabel && <p className="text-xs text-gray-400 mt-1">precio por {unitLabel}</p>}
      </div>

      {/* PEDIDO MÍNIMO + PRECIO TOTAL */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Pedido mínimo</p>
          <p className="text-xl font-semibold text-gray-900">{minimumOrder} uds.</p>
          {unitLabel && <p className="text-xs text-gray-500 mt-0.5">{unitLabel} c/u</p>}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Precio mínimo total</p>
          <p className="text-xl font-semibold text-gray-900">
            ${(price * minimumOrder).toLocaleString("es-AR")}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {minimumOrder} × ${price.toLocaleString("es-AR")}
          </p>
        </div>
      </div>

      {/* PROGRESO FRACCIONADO */}
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
              style={{
                width: `${Math.min((progressData.accumulatedQty / minimumOrder) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* COMPRA */}
      {userId && (
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
        />
      )}
    </>
  );
}