export type ShippingConfig = {
  // ✅ Retiro en fábrica (opcional y combinable)
  allowPickup: boolean;

  // 🚚 Tipo principal de envío
  shippingType: "own" | "third_party";

  // ============================
  // 🏭 LOGÍSTICA PROPIA
  // ============================
  ownShipping?: {
    pricingModel: "km" | "zones" | "region";

    // 🔹 Precio por KM
    perKmRate?: number;

    // 🔹 Zonas por distancia
    kmZones?: {
      z1: number; // ej: hasta 10km
      z2: number; // ej: hasta 30km
      z3: number; // ej: +30km
    };

    // 🔹 Regiones geográficas
    regionPrices?: {
      caba: number;
      amba: number;
      interior: number;
    };
  };

  // ============================
  // 🚚 ENVÍO POR TERCEROS
  // ============================
  thirdPartyShipping?: {
    fixedPrice: number; // precio único fijo
  };
};