import { ProductShipping } from "../../lib/types/product";

export class ShippingConfigError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export function validateShippingConfig(shipping: ProductShipping) {
  if (!shipping) {
    throw new ShippingConfigError(
      "El producto no tiene configuración de envío",
      "SHIPPING_MISSING"
    );
  }

  const hasAnyMethod =
    shipping.methods.length > 0;

  if (!hasAnyMethod) {
    throw new ShippingConfigError(
      "Debe existir al menos un método de entrega",
      "NO_SHIPPING_METHOD"
    );
  }

  // 🚚 Envío propio
  if (shipping.methods.includes("own_logistics")) {
    const own = shipping.ownLogistics;

    if (!own) {
      throw new ShippingConfigError(
        "Falta configuración de envío propio",
        "OWN_LOGISTICS_MISSING"
      );
    }

    if (own.type === "per_km" && own.pricePerKm <= 0) {
      throw new ShippingConfigError(
        "Precio por km inválido",
        "OWN_LOGISTICS_KM_INVALID"
      );
    }

    if (own.type === "zones") {
      const { zone1, zone2, zone3 } = own.zones;
      if (zone1 <= 0 || zone2 <= 0 || zone3 <= 0) {
        throw new ShippingConfigError(
          "Zonas de distancia inválidas",
          "OWN_LOGISTICS_ZONES_INVALID"
        );
      }
    }

    if (own.type === "geographic") {
      if (own.areas.amba <= 0) {
        throw new ShippingConfigError(
          "Precio AMBA inválido",
          "OWN_LOGISTICS_GEO_INVALID"
        );
      }
    }
  }

  // 🚛 Terceros
  if (shipping.methods.includes("third_party")) {
    if (
      !shipping.thirdParty ||
      shipping.thirdParty.fixedPrice <= 0 ||
      !shipping.thirdParty.disclaimerAccepted
    ) {
      throw new ShippingConfigError(
        "Configuración inválida de envío por terceros",
        "THIRD_PARTY_INVALID"
      );
    }
  }

  // 🏭 Retiro en fábrica: siempre válido
}
