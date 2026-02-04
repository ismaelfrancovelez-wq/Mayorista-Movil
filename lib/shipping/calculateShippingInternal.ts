import { ProductShipping } from "../../lib/types/product";
import { calculateOwnShipping } from "./ownShipping";
import { calculateThirdPartyShipping } from "./thirdPartyShipping";

type Address = {
  lat: number;
  lng: number;
};

type Params = {
  shippingConfig: ProductShipping;
  factoryAddress: Address;
  retailerAddress: Address;
};

export function calculateShippingInternal({
  shippingConfig,
  factoryAddress,
  retailerAddress,
}: Params) {
  const results: Array<{
    method: "factory_pickup" | "own_shipping" | "third_party";
    cost: number;
  }> = [];

  const methods = shippingConfig.methods;

  // 🏭 Retiro en fábrica
  if (methods.includes("factory_pickup")) {
    results.push({ method: "factory_pickup", cost: 0 });
  }

  // 🚚 Envío propio
  if (
    methods.includes("own_logistics") &&
    shippingConfig.ownLogistics
  ) {
    const cost = calculateOwnShipping(
      factoryAddress,
      retailerAddress,
      shippingConfig.ownLogistics
    );

    results.push({ method: "own_shipping", cost });
  }

  // 🚛 Envío por terceros
  if (
    methods.includes("third_party") &&
    shippingConfig.thirdParty
  ) {
    const cost = calculateThirdPartyShipping(
      shippingConfig.thirdParty.fixedPrice
    );

    results.push({ method: "third_party", cost });
  }

  if (results.length === 0) {
    return {
      available: false,
      reason: "El producto no tiene métodos de envío disponibles",
    };
  }

  return {
    available: true,
    options: results,
  };
}