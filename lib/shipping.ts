import { env } from "./env";

/**
 * Dirección base fija (centro logístico)
 * Poeta Romildo Risso 3244, William Morris, Hurlingham
 */
const BASE_ADDRESS =
  "Poeta Romildo Risso 3244, William Morris, Hurlingham, Buenos Aires, Argentina";

const PRECIO_POR_KM = 85;
const FIJO_CONDUCTOR = 3500;

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
 */
export async function calculateFraccionadoShipping(params: {
  factoryAddress: string;
  retailerAddress: string;
}): Promise<ShippingResult> {
  const { factoryAddress, retailerAddress } = params;

  const apiKey = env.googleMaps.apiKey();

  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no configurada");
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