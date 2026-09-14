import { Schema, model } from 'mongoose';

// A unique deterministic _id atomically reserves one checkout per local order.
const schema = new Schema(
  {
    _id: { type: String, required: true },
    kind: { type: String, enum: ['order', 'auction-sheet'], required: true },
    orderId: { type: String, required: true },
    userId: String,
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
    },
    paymentUrl: String,
    gatewayId: String,
    paidTransactionId: String,
    initializationState: {
      type: String,
      enum: ['INITIALIZING', 'READY', 'REJECTED', 'UNKNOWN'],
    },
  },
  { timestamps: true },
);

export const EPSCheckout = model('EPSCheckout', schema);
