// lib/types/featured.ts

export type FeaturedType = "product" | "factory";

export type FeaturedDuration = 7 | 15 | 30; // días

export const FEATURED_PRICES: Record<FeaturedDuration, number> = {
  7: 14000,   // 1 semana = $14,000
  15: 28000,  // 15 días = $28,000
  30: 50000, // 1 mes = $50,000
};

export const FEATURED_SLOTS = {
  product: 10,  // 10 slots para productos
  factory: 10,  // 10 slots para fábricas
};

export interface FeaturedItem {
  id?: string;
  type: FeaturedType;
  itemId: string; // productId o factoryId
  factoryId: string; // siempre el fabricante que paga
  
  // Duración y fechas
  duration: FeaturedDuration;
  startDate: Date;
  endDate: Date;
  
  // Pago
  paymentId: string;
  amount: number;
  
  // Estado
  active: boolean;
  expired: boolean;
  
  // Metadata (para mostrar en home)
  metadata: {
    name: string;
    description?: string;
    imageUrl?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface FeaturedSlotStatus {
  total: number;
  occupied: number;
  available: number;
  items: FeaturedItem[];
}