import { Schema, model, Document, Types } from 'mongoose';
import { IProductComment } from './comment.interface';

const productCommentSchema = new Schema<IProductComment & Document>(
  {
    user: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    likes: {
      type: [String],
      required: false,
      default: [],
    },
    replies: {
      type: [
        {
          user: {
            type: Types.ObjectId,
            ref: 'User',
            required: true,
          },
          reply: {
            type: String,
            required: true,
            trim: true,
          },
        },
      ],
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

export const ProductComment = model<IProductComment & Document>(
  'ProductComment',
  productCommentSchema,
);
