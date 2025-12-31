export interface FraccionatedOrder {
  retailerId: string;
  qty: number;
  paymentId: string;
}

export interface Lot {
  productId: string;
  factoryId: string;
  MF: number;
  accumulatedQty: number;
  orders: FraccionatedOrder[];
  status: "accumulating" | "closed";
  createdAt: any;
  updatedAt?: any;
  closedAt?: any;
}
