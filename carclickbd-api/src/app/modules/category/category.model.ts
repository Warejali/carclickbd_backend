import { Schema, model } from 'mongoose';
import { CategoryType } from './category.interface';

const categorySchema = new Schema<CategoryType>(
  {
    title: {
      type: String,
      required: true,
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

categorySchema.pre('save', function (next) {
  this.title = this.title.toLowerCase();
  next();
});

categorySchema.index({ parentCategory: 1, title: 1 }, { unique: true });

export const Category = model<CategoryType>('Category', categorySchema);
