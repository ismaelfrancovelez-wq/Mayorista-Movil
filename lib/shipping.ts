import { env } from "./env";

/**
 * Dirección base fija (centro logístico)
 * Poeta Romildo Risso 3244, William Morris, Hurlingham
 */
const BASE_ADDRESS =
  "Poeta Romildo Risso 3244, William Morris, Hurlingham, Buenos Aires, Argentina";

const PRECIO_POR_KM = 85;
const FIJO_CONDUCTOR = 3500;

// ✅ FIX ERROR 12: Costo fijo de fallback cuando no hay API key de Google Maps.
// Antes la función lanzaba una excepción que podía romper páginas enteras.
// Ahora devuelve un costo estimado razonable sin romper nada.
const FALLBACK_SHIPPING_COST = 8000;

export type ShippingResult = {
  kmBaseToFactory: number;
  kmFactoryToRetailer: number;
  kmTotal: number;
  kmCharged: number;
  totalCost: number;
};

/**
 * Calcula envío fraccionado usando Google Maps Distance Matrix API
 * ⚠️ REQUIERE direcciones válidas (string de texto completo)
 * ✅ FIX ERROR 12: Si no hay API key, devuelve un costo fijo en lugar de lanzar excepción
 */
export async function calculateFraccionadoShipping(params: {
  factoryAddress: string;
  retailerAddress: string;
}): Promise<ShippingResult> {
  const { factoryAddress, retailerAddress } = params;

  // ✅ FIX ERROR 12: getEnvOptional puede devolver "" si la key no está configurada.
  // Verificamos con trim() para también cubrir el caso de espacios en blanco.
  const apiKey = env.googleMaps.apiKey();

  if (!apiKey || apiKey.trim() === "") {
    // No hay API key — devolver resultado de fallback en lugar de lanzar excepción
    console.warn("⚠️ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no configurada. Usando costo de envío fijo como fallback.");
    return {
      kmBaseToFactory: 0,
      kmFactoryToRetailer: 0,
      kmTotal: 0,
      kmCharged: 0,
      totalCost: FALLBACK_SHIPPING_COST,
    };
  }

  const kmBaseToFactory = await getKm(
    BASE_ADDRESS,
    factoryAddress,
    apiKey
  );

  const kmFactoryToRetailer = await getKm(
    factoryAddress,
    retailerAddress,
    apiKey
  );

  const kmTotal = kmBaseToFactory + kmFactoryToRetailer;
  const kmCharged = kmTotal * 2; // ida y vuelta

  const totalCost = Math.round(
    kmCharged * PRECIO_POR_KM + FIJO_CONDUCTOR
  );

  return {
    kmBaseToFactory,
    kmFactoryToRetailer,
    kmTotal,
    kmCharged,
    totalCost,
  };
}

async function getKm(
  origin: string,
  destination: string,
  apiKey: string
): Promise<number> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/distancematrix/json"
  );

  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "ar");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (
    data.status !== "OK" ||
    data.rows[0].elements[0].status !== "OK"
  ) {
    throw new Error(
      `Error calculando distancia: ${data.status} / ${data.rows?.[0]?.elements?.[0]?.status}`
    );
  }

  return data.rows[0].elements[0].distance.value / 1000;
}