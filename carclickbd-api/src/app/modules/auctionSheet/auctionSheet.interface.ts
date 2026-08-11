import { Types } from 'mongoose';

export type AuctionSheetOrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export type IAuctionSheetOrder = {
  _id?: Types.ObjectId;
  chassis: string;
  normalizedChassis: string;
  name: string;
  email: string;
  mobileNumber: string;
  address: string;
  amount: number;
  currency: string;
  termsAccepted: boolean;
  status: AuctionSheetOrderStatus;
  bdgateSessionToken?: string;
  bdgatePaymentUrl?: string;
  bdgateStatus?: string;
  transactionId?: string;
  jpcenterRecordKey?: string;
  jpcenterPdfUrl?: string;
  jpcenterReportFetchedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};
