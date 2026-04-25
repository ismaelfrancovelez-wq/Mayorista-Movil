"use client";

import { useEffect, useState } from "react";

type ProgressData = {
  withShipping: { accumulatedQty: number; MF: number; percentage: number };
  withoutShipping: { accumulatedQty: number; MF: number; percentage: number };
};

type Props = {
  productId: string;
  minimumIndex?: number;
  formatIndex?: number;
  allowPickup: boolean;
  allowFactoryShipping: boolean;
};

export default function LotProgressBar({
  productId,
  minimumIndex = 0,
  formatIndex = 0,
  allowPickup,
  allowFactoryShipping,
}: Props) {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    setData(null);
    fetch(
      `/api/lots/fraccionado/progress?productId=${productId}&minimumIndex=${minimumIndex}&formatIndex=${formatIndex}`
    )
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => null);
  }, [productId, minimumIndex, formatIndex]);

  if (!data) return null;

  const showShipping = allowFactoryShipping || data.withShipping.MF > 0;
  const showPickup = allowPickup || data.withoutShipping.MF > 0;

  const hasAnyActivity = data.withShipping.accumulatedQty > 0 || data.withoutShipping.accumulatedQty > 0;
if (!hasAnyActivity) return null;

  return (
    <div className="bg-blue-50 rounded-lg p-3 mb-3">
      <h3 className="font-semibold text-xs mb-2 text-blue-900">📦 Progreso del lote</h3>

      {showShipping && (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>🚚 Con envío</span>
            <span>
              {data.withShipping.accumulatedQty} / {data.withShipping.MF > 0 ? data.withShipping.MF : "—"} uds.
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${data.withShipping.percentage}%` }}
            />
          </div>
          {data.withShipping.accumulatedQty === 0 && (
            <p className="text-xs text-gray-400 mt-1">Sé el primero en sumarte</p>
          )}
        </div>
      )}

      {showPickup && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>🏪 Retiro en fábrica</span>
            <span>
              {data.withoutShipping.accumulatedQty} / {data.withoutShipping.MF > 0 ? data.withoutShipping.MF : "—"} uds.
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${data.withoutShipping.percentage}%` }}
            />
          </div>
          {data.withoutShipping.accumulatedQty === 0 && (
            <p className="text-xs text-gray-400 mt-1">Sé el primero en sumarte</p>
          )}
        </div>
      )}
    </div>
  );
}