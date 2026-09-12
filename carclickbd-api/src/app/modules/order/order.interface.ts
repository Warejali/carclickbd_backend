import { Types } from 'mongoose';

export type IOrder = {
  user: Types.ObjectId;
  product: Types.ObjectId;
  order: Types.ObjectId;
  orderNumber: string;
  totalQuantity: number;
  totalAmount: number;
  serverPriced?: boolean;
  items?: { product: string; quantity: number; unitAmount: number }[];
  isPending?: boolean;
  buyerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      state?: string;
      city?: string;
      zipCode?: number;
    };
  };
  paymentStatus?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type IOrderFilterableField = {
  searchTerm: string;
  user: string;
  totalQuantity: string;
  orderNumber: string;
  product: string;
  totalAmount: string;
  createdAt: string;
};
