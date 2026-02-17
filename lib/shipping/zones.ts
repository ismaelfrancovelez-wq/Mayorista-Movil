export type KmZones = {
  z1: number; // 0-15 km
  z2: number; // 15-35 km
  z3: number; // 35-60 km
  z4: number; // +60 km
};

export function calculateZoneShipping(
  distanceKm: number,
  kmZones: KmZones
): { cost: number; zone: "z1" | "z2" | "z3" | "z4" } {
  if (distanceKm <= 15) {
    return { cost: kmZones.z1, zone: "z1" };
  }

  if (distanceKm <= 35) {
    return { cost: kmZones.z2, zone: "z2" };
  }

  if (distanceKm <= 60) {
    return { cost: kmZones.z3, zone: "z3" };
  }

  // > 60 km
  return { cost: kmZones.z4, zone: "z4" };
}