export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  if (
    typeof a.lat !== "number" ||
    typeof a.lng !== "number" ||
    typeof b.lat !== "number" ||
    typeof b.lng !== "number"
  ) {
    throw new Error("Coordenadas inválidas para calcular distancia");
  }

  const R = 6371; // Radio de la Tierra en km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  const distance = R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return Math.round(distance * 100) / 100; // 2 decimales
}
