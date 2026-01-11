export type ShippingConfig = {
  // 1️⃣ Retiro en fábrica (independiente)
  allowPickup: boolean;

  // 2️⃣ Tipo de envío cuando NO es retiro
  shippingType: "own" | "third_party";

  // 🔵 Logística propia
  ownShipping?: {
    pricingModel: "km" | "zones_km" | "zones_geo";

    perKmRate?: number;

    kmZones?: {
      z1: number;
      z2: number;
      z3: number;
    };

    geoZones?: {
      caba: number;
      gba: number;
      interior: number;
    };
  };

  // 🟠 Envío por terceros
  thirdPartyShipping?: {
    fixedPrice: number;
  };
};