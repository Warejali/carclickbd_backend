import { Types } from 'mongoose';

export type IPayment = {
  user: Types.ObjectId;
  product?: Types.ObjectId;
  order: Types.ObjectId;
  amount: number;
  transactionId?: string;
  paymentMethod?: string;
  idempotencyKey?: string;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  orderId?: string;
  currency?: string;
  gateway?: string;
  bdgateSessionToken?: string;
  bdgatePaymentUrl?: string;
  bdgateStatus?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

export type IPaymentFilterableField = {
  searchTerm: string;
  user: string;
  message: string;
  isRead: boolean;
  product: string;
  amount: string;
  paymentStatus?: string;
  transactionId?: string;
  paymentMethod?: string;
  createdAt: string;
};
