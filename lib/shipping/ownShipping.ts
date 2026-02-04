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

  // 2️⃣ Zonas por distancia
  if (config.type === "zones") {
    if (km <= 10) return config.zones.zone1;
    if (km <= 30) return config.zones.zone2;
    return config.zones.zone3;
  }

  // 3️⃣ Zonas geográficas
  if (config.type === "geographic") {
    // simplificado: asumimos AMBA
    return config.areas.amba;
  }

  throw new Error("Modelo de envío propio inválido");
}
