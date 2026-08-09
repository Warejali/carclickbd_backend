import { Schema, model } from 'mongoose';
import { IOrder } from './order.interface';
const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    orderNumber: {
      type: String,
      required: false,
    },
    isPending: {
      type: Boolean,
      default: true,
    },

    totalQuantity: {
      type: Number,
      default: 1,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    buyerInfo: {
      name: {
        type: String,
        required: false,
      },
      email: {
        type: String,
        required: true,
      },
      phone: {
        type: Number,
        required: true,
      },

      address: {
        street: {
          type: String,
          required: false,
        },
        state: {
          type: String,
          required: false,
        },
        city: {
          type: String,
          required: false,
        },
        zipCode: {
          type: Number,
          required: false,
        },
      },
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

export const Order = model<IOrder>('Order', orderSchema);
