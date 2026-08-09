import { Types } from 'mongoose';
import { IUser } from '../../user/user.interface';
import { IProduct } from '../product.interface';

export type IWatchlist = {
  user: Types.ObjectId | IUser;
  product: Types.ObjectId | IProduct;
};
