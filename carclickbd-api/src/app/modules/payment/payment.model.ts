import { Schema, model } from 'mongoose';
import { IPayment } from './payment.interface';

const paymentSchema = new Schema<IPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    transactionId: {
      type: String,
      required: false,
    },
    paymentMethod: {
      type: String,
      required: false,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    currency: {
      type: String,
      default: 'BDT',
    },
    gateway: {
      type: String,
      required: false,
    },
    bdgateSessionToken: {
      type: String,
      required: false,
      index: true,
    },
    bdgatePaymentUrl: {
      type: String,
      required: false,
    },
    bdgateStatus: {
      type: String,
      required: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Payment = model<IPayment>('Payment', paymentSchema);
