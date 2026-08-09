import { IProduct } from '../../product.interface';

import { ProductComment } from '../comment.model';
import { ICommentHistory } from './commenthistory.interface';

const getMyCommentHistory = async (
  userId: string,
): Promise<ICommentHistory[]> => {
  const comments = await ProductComment.find({ user: userId })
    .populate({
      path: 'product',
      select: 'maker model photos.mainPhoto ',
    })
    .select('comment user  createdAt updatedAt ');

  const commentHistory = comments?.map(comment => ({
    comment: comment,
    message: `On ${comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'an unknown date'}, you commented on the ${(comment.product as IProduct)?.maker} <a href="/products/${(comment.product as IProduct)?._id}">${(comment.product as IProduct).model}</a>.`,
  }));

  return commentHistory;
};

export const CommentHistoryService = {
  getMyCommentHistory,
};
