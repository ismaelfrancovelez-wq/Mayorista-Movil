// app/api/products/fetch-retail-price-preview/route.ts
//
// 🎯 ¿QUÉ HACE ESTE ARCHIVO?
//   Cuando el fabricante hace click en "Buscar en ML" en el formulario de crear/editar
//   producto, este endpoint llama a la API pública de MercadoLibre Argentina,
//   busca el producto por nombre, y devuelve el precio mediano de los resultados.
//
//   IMPORTANTE: Este endpoint NO guarda nada en Firestore.
//   Solo devuelve el precio para que el fabricante lo vea y decida si cargarlo o no.
//   El precio se guarda recién cuando el fabricante hace click en "Crear producto" o
//   "Guardar cambios".
//
// 💰 COSTO: $0
//   La API de búsqueda de MercadoLibre es pública y no requiere API key.
//   URL: https://api.mercadolibre.com/sites/MLA/search?q=...
//
// ⚡ POR QUÉ MEDIANA Y NO PROMEDIO:
//   En ML hay productos cargados en $1 (errores) o $999999 (acaparadores).
//   La mediana ignora esos extremos y da el precio "del medio" — el más representativo.

export const runtime = "nodejs";

import { NextResponse } from "next/server";

// ─── Limpia el nombre del producto para la búsqueda ───────────────────────────
// Elimina cosas que confunden a ML: códigos entre corchetes [ABC123],
// unidades de medida como "500g" o "x6", y espacios extras.
function buildMLQuery(productName: string): string {
  return productName
    .replace(/\[.*?\]/g, "")                          // elimina [CODIGO]
    .replace(/\b\d+(g|kg|ml|l|cc|x\d+)\b/gi, "")    // elimina 500g, 1kg, x6, etc.
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60); // ML acepta hasta 60 chars en el query
}

// ─── Calcula la mediana de un array de precios ────────────────────────────────
function median(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Si hay cantidad par de elementos, promediamos los dos del medio
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export async function POST(req: Request) {
  try {
    const { productName } = await req.json();

    if (!productName?.trim()) {
      return NextResponse.json(
        { error: "Falta el nombre del producto" },
        { status: 400 }
      );
    }

    const query = buildMLQuery(productName);

    if (!query) {
      return NextResponse.json({ retailReferencePrice: null, message: "El nombre no es válido para buscar" });
    }

    // Llamamos a la API pública de ML Argentina — sin API key, sin costo
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=10`;

    const res = await fetch(url, {
      headers: { "User-Agent": "MayoristaMovil/1.0" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({
        retailReferencePrice: null,
        message: "MercadoLibre no respondió. Intentá de nuevo o cargá el precio manualmente.",
      });
    }

    const data = await res.json();
    const results: { price: number; condition: string }[] = data.results || [];

    // Solo tomamos productos NUEVOS con precio mayor a $100 (evita errores de carga)
    const prices = results
      .filter((r) => r.condition === "new" && r.price > 100)
      .map((r) => r.price);

    if (prices.length === 0) {
      return NextResponse.json({
        retailReferencePrice: null,
        message: "No se encontraron resultados en MercadoLibre para este producto.",
      });
    }

    // Quitamos el 10% más caro y el 10% más barato para evitar outliers extremos
    const sorted = [...prices].sort((a, b) => a - b);
    const trimCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    const mlPrice = median(trimmed.length > 0 ? trimmed : sorted);

    return NextResponse.json({
      retailReferencePrice: mlPrice,
      query, // lo devolvemos para debugging si es necesario
      message: `Precio referencial de MercadoLibre: $${mlPrice.toLocaleString("es-AR")}`,
    });

  } catch (error) {
    console.error("fetch-retail-price-preview error:", error);
    return NextResponse.json({
      retailReferencePrice: null,
      message: "Error interno. Podés cargar el precio manualmente.",
    });
  }
}