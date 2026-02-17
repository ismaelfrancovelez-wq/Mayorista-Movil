import { distanceKm } from "./distance";
import { ProductShipping } from "../../lib/types/product";

type Address = {
  lat: number;
  lng: number;
};

export function calculateOwnShipping(
  factoryAddress: Address,
  retailerAddress: Address,
  config: ProductShipping["ownLogistics"]
): number {
  if (!config) {
    throw new Error("Config ownLogistics faltante");
  }

  const km = distanceKm(factoryAddress, retailerAddress);

  // 1️⃣ Precio por KM
  if (config.type === "per_km") {
    return Math.round(km * config.pricePerKm);
  }

  // 2️⃣ Zonas por distancia (4 zonas: z1, z2, z3, z4)
  if (config.type === "zones") {
    if (km <= 15) return config.zones.z1;   // 0-15km
    if (km <= 35) return config.zones.z2;   // 15-35km
    if (km <= 60) return config.zones.z3;   // 35-60km
    return config.zones.z4;                 // +60km
  }

  throw new Error("Modelo de envío propio inválido");
}