import { Types } from 'mongoose';
import { IProductComment } from '../comment.interface';

export type ICommentHistory = {
  comment: Types.ObjectId | IProductComment;
  message: string;
};
