import { Schema, model, Types } from 'mongoose';
import { ICommentHistory } from './commenthistory.interface';

const CommentHistorySchema = new Schema<ICommentHistory>(
  {
    comment: {
      type: Types.ObjectId,
      ref: 'ProductComment',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const CommentHistory = model<ICommentHistory>(
  'CommentHistory',
  CommentHistorySchema,
);

export default CommentHistory;
