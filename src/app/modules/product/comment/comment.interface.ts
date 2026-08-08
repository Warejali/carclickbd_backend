import { Types } from 'mongoose';
import { IUser } from '../../user/user.interface';
import { IProduct } from '../product.interface';

export type IProductComment = {
  save(): unknown;
  user: Types.ObjectId | IUser | string;
  product: Types.ObjectId | IProduct | string;
  comment: string;
  likes: string[];
  replies: [{ user: Types.ObjectId | string; reply: string }];
  createdAt?: string;
};
