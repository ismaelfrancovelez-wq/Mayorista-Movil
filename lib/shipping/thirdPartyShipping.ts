export function calculateThirdPartyShipping(
  fixedPrice: number
): number {
  if (
    typeof fixedPrice !== "number" ||
    isNaN(fixedPrice) ||
    fixedPrice <= 0
  ) {
    throw new Error("Precio fijo de envío por terceros inválido");
  }

  return Math.round(fixedPrice);
}
