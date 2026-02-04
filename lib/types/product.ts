// lib/types/product.ts

export type ProfitType = "percentage" | "fixed";

export type ShippingMethod =
  | "own_logistics"
  | "third_party"
  | "factory_pickup";

export type OwnLogisticsPricing =
  | {
      type: "per_km";
      pricePerKm: number;
    }
  | {
      type: "zones";
      zones: {
        zone1: number;
        zone2: number;
        zone3: number;
      };
    }
  | {
      type: "geographic";
      areas: {
        caba: number;
        amba: number;
        interior: number;
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
  | "libreria"
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
  libreria: "Librería y Oficina",
  deportes: "Deportes y Fitness",
  automotor: "Automotor",
  mascotas: "Mascotas",
  otros: "Otros",
};

export interface Product {
  id?: string;

  /* 🏭 PROPIETARIO */
  factoryId: string;

  /* 📦 BÁSICO */
  name: string;
  description?: string;
  price: number;
  minimumOrder: number;

  /* ✅ Categoría del producto */
  category: ProductCategory;

  /* 🖼️ IMAGEN DEL PRODUCTO - 🆕 NUEVO CAMPO */
  imageUrl?: string;

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