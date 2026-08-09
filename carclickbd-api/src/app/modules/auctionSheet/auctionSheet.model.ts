import { Schema, model } from 'mongoose';
import {
  AuctionSheetOrderStatus,
  IAuctionSheetOrder,
} from './auctionSheet.interface';

const auctionSheetOrderSchema = new Schema<IAuctionSheetOrder>(
  {
    chassis: { type: String, required: true, trim: true },
    normalizedChassis: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobileNumber: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    termsAccepted: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as AuctionSheetOrderStatus[],
      default: 'PENDING',
      index: true,
    },
    bdgateSessionToken: { type: String, index: true },
    bdgatePaymentUrl: { type: String },
    bdgateStatus: { type: String },
    transactionId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const AuctionSheetOrder = model<IAuctionSheetOrder>(
  'AuctionSheetOrder',
  auctionSheetOrderSchema,
);
