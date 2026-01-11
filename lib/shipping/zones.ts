export type KmZones = {
  z1: number; // 0–10 km
  z2: number; // 10–30 km
  z3: number; // 30–60 km
};

export function calculateZoneShipping(
  distanceKm: number,
  kmZones: KmZones
): { cost: number; zone: "z1" | "z2" | "z3" } {
  if (distanceKm <= 10) {
    return { cost: kmZones.z1, zone: "z1" };
  }

  if (distanceKm <= 30) {
    return { cost: kmZones.z2, zone: "z2" };
  }

  // > 30 km
  return { cost: kmZones.z3, zone: "z3" };
}