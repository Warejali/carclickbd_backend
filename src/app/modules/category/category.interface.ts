import { Types, Document } from 'mongoose';

export type CategoryInput = {
  title: string;
  parentCategory?: Types.ObjectId | string;
};

export type CategoryType = Document & {
  title: string;
  parentCategory?: Types.ObjectId;
};
