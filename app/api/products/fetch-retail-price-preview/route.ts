// app/api/products/fetch-retail-price-preview/route.ts
//
// Este endpoint lo llama el botón "🔍 Buscar en ML" del formulario
// de crear/editar producto. Busca en MercadoLibre Argentina (sin API key,
// es gratis) y devuelve el precio mediano de los resultados.
// NO guarda nada en Firestore.

export const runtime = "nodejs";

import { NextResponse } from "next/server";

function buildMLQuery(productName: string): string {
  return productName
    .replace(/\[.*?\]/g, "")
    .replace(/\b\d+(g|kg|ml|l|cc|x\d+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function median(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const productName: string = body?.productName || "";

    if (!productName.trim()) {
      return NextResponse.json(
        { retailReferencePrice: null, message: "Falta el nombre del producto" },
        { status: 400 }
      );
    }

    const query = buildMLQuery(productName);

    if (!query) {
      return NextResponse.json({
        retailReferencePrice: null,
        message: "El nombre no es suficiente para buscar",
      });
    }

    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=12`;

    const res = await fetch(url, {
      headers: { "User-Agent": "MayoristaMovil/1.0" },
      // next.js cache desactivado — queremos precio fresco
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({
        retailReferencePrice: null,
        message: "MercadoLibre no respondió. Intentá de nuevo.",
      });
    }

    const data = await res.json();
    const results: { price: number; condition: string }[] = data.results || [];

    // Solo nuevos, precio > $500 (filtra artículos cargados a precio raro)
    const prices = results
      .filter((r) => r.condition === "new" && r.price > 500)
      .map((r) => r.price);

    if (prices.length === 0) {
      // Segundo intento sin filtro de condición (algunos vendedores no cargan "new")
      const allPrices = results
        .filter((r) => r.price > 500)
        .map((r) => r.price);

      if (allPrices.length === 0) {
        return NextResponse.json({
          retailReferencePrice: null,
          message: "No se encontraron resultados en MercadoLibre.",
        });
      }

      const mlPrice = median(allPrices);
      return NextResponse.json({
        retailReferencePrice: mlPrice,
        query,
        message: `Precio referencial: $${mlPrice.toLocaleString("es-AR")}`,
      });
    }

    // Quitamos el 10% más caro y el 10% más barato para evitar outliers
    const sorted = [...prices].sort((a, b) => a - b);
    const trimCount = Math.max(0, Math.floor(sorted.length * 0.1));
    const trimmed = trimCount > 0
      ? sorted.slice(trimCount, sorted.length - trimCount)
      : sorted;

    const mlPrice = median(trimmed.length > 0 ? trimmed : sorted);

    return NextResponse.json({
      retailReferencePrice: mlPrice,
      query,
      message: `Precio referencial: $${mlPrice.toLocaleString("es-AR")}`,
    });

  } catch (error) {
    console.error("fetch-retail-price-preview error:", error);
    return NextResponse.json({
      retailReferencePrice: null,
      message: "Error interno. Podés cargar el precio manualmente.",
    });
  }
}