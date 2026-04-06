// lib/types/product.ts
// ✅ ACTUALIZADO - agregado sellerType para identificar fabricante, distribuidor o mayorista

export type ProfitType = "percentage" | "fixed";

export type ShippingMethod =
  | "own_logistics"
  | "third_party"
  | "factory_pickup";

export type OwnLogisticsPricing =
  | {
      type: "per_km";
      pricePerKm: number;
      roundTrip: boolean;  // ✅ true = ida y vuelta, false = solo ida
    }
  | {
      type: "zones";
      zones: {
        z1: number;  // 0-15km
        z2: number;  // 15-35km
        z3: number;  // 35-60km
        z4: number;  // +60km
      };
    };

export interface ProductShipping {
  methods: ShippingMethod[];
  ownLogistics?: OwnLogisticsPricing;
  thirdParty?: {
    fixedPrice: number;
    disclaimerAccepted: boolean;
  };
  factoryPickup?: boolean;
  noShipping?: boolean; // fabricante no realiza envíos — solo fraccionado por plataforma
}

export interface ProductProfit {
  type: ProfitType;
  value: number;
}

// ✅ Categorías/Rubros disponibles
export type ProductCategory =
  | "alimentos"
  | "bebidas"
  | "indumentaria"
  | "calzado"
  | "electronica"
  | "hogar"
  | "construccion"
  | "salud_belleza"
  | "jugueteria"
  | "limpieza"
  | "deportes"
  | "automotor"
  | "mascotas"
  | "otros";

// ✅ Labels amigables para categorías
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  alimentos: "Alimentos y Bebidas",
  bebidas: "Bebidas",
  indumentaria: "Indumentaria",
  calzado: "Calzado",
  electronica: "Electrónica",
  hogar: "Hogar y Decoración",
  construccion: "Construcción y Ferretería",
  salud_belleza: "Salud y Belleza",
  jugueteria: "Juguetería",
  limpieza: "Limpieza",
  deportes: "Deportes y Fitness",
  automotor: "Automotor",
  mascotas: "Mascotas",
  otros: "Otros",
};

// ✅ NUEVO: Tipo de vendedor
export type SellerType = "manufacturer" | "distributor" | "wholesaler";

// ✅ Labels amigables para el tipo de vendedor
export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  manufacturer: "Fabricante",
  distributor: "Distribuidor",
  wholesaler: "Mayorista",
};

// ✅ Colores para la etiqueta del tipo de vendedor (usados en el explorador)
export const SELLER_TYPE_COLORS: Record<SellerType, string> = {
  manufacturer: "bg-blue-100 text-blue-800",
  distributor: "bg-purple-100 text-purple-800",
  wholesaler: "bg-green-100 text-green-800",
};

export interface PurchaseFormat {
  unitLabel: string;    // "Por unidad", "Pack 6", "Caja 12"
  unitsPerPack: number; // 1, 6, 12 — para calcular precio/unidad
  price: number;        // precio por este formato
}

export interface ProductMinimum {
  type: "quantity" | "amount"; // "quantity" = N unidades, "amount" = $N pesos
  value: number;               // 100 (uds) o 1000000 (pesos)
  formats: PurchaseFormat[];   // presentaciones disponibles para este mínimo
}

export interface Product {
  id?: string;

  /* 🏭 PROPIETARIO */
  factoryId: string;

  // ✅ NUEVO: tipo de vendedor que publicó el producto
  sellerType?: SellerType;

  /* 📦 BÁSICO */
  name: string;
  description: string;        // ✅ obligatorio
  unitLabel?: string;           // opcional — ej: "500g", "1kg", "750ml", "pack x6"
  price: number;
  minimumOrder: number;

  /* ✅ Categoría del producto */
  category: ProductCategory;

  /* 🖼️ IMÁGENES DEL PRODUCTO */
  imageUrls?: string[];       // ✅ array de URLs en lugar de imageUrl string

  /* 💰 Ganancia neta informativa por unidad (solo fabricante) */
  netProfitPerUnit: number;

  /* 🚚 ENVÍOS */
  shipping: ProductShipping;

  /* ⭐ DESTACADO */
  featured: boolean;
  featuredUntil?: Date;

  /* 🆕 INTERMEDIARIO - Indica si la plataforma actúa como intermediario */
  isIntermediary?: boolean;

  /* 📊 ESTADO */
  active: boolean;

  /* 🕒 FECHAS */
  createdAt: Date;
  updatedAt: Date;
}