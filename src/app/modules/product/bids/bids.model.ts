import { Schema, model } from 'mongoose';
import { IBid } from './bids.interface';

const bidSchema = new Schema<IBid>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    bidAmount: {
      type: String,
      required: true,
    },
    isWinner: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const Bid = model<IBid>('Bid', bidSchema);
