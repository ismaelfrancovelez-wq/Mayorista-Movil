import { distanceKm } from "./distance";

const BASE_ADDRESS = {
  lat: -34.588488,
  lng: -58.664829,
};

export function calculateFraccionadoShipping({
  factoryAddress,
  retailerAddress,
}: {
  factoryAddress: { lat: number; lng: number };
  retailerAddress: { lat: number; lng: number };
}) {
  const kmBaseFactory = distanceKm(BASE_ADDRESS, factoryAddress);
  const kmFactoryRetailer = distanceKm(factoryAddress, retailerAddress);

  const totalKm = (kmBaseFactory + kmFactoryRetailer) * 2;
  const cost = totalKm * 85 + 3500;

  return {
    shippingMode: "platform",
    shippingCost: Math.round(cost),
  };
}