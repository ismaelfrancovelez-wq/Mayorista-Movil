/**
 * FIREBASE CLOUD FUNCTIONS
 * 
 * Punto de entrada para todas las Cloud Functions
 */

// ✅ Exportar función de cron de destacados
export { checkFeaturedExpiration } from "./scheduled/checkFeaturedExpiration";

// ✅ Aquí podés agregar otras functions en el futuro
// export { myOtherFunction } from "./other/myOtherFunction";