import httpStatus from 'http-status';
import ApiError from '../../../../errors/ApiError';
import { ProductComment } from './comment.model';
import { IProductComment } from './comment.interface';
import { JwtPayload } from 'jsonwebtoken';
import { Product } from '../product.model';

// Create a new product comment
const createComment = async (
  payload: IProductComment,
): Promise<IProductComment> => {
  const { product } = payload;

  // Check if the product exists and fetch necessary fields
  const productExists = await Product.findById(product).select('totalComment');
  if (!productExists) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'The product you are trying to comment on does not exist.',
    );
  }

  // Increment total comments and save
  productExists.totalComment = (Number(productExists?.totalComment) || 0) + 1;
  await productExists.save();

  // Create and return the comment
  return await ProductComment.create(payload);
};

// Post a reply to a comment
const postCommentReply = async (
  commentId: string,
  payload: { user: string; reply: string },
): Promise<IProductComment> => {
  const comment = await ProductComment.findById(commentId);

  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  comment.replies.push(payload);
  await comment.save();
  return comment;
};

// Like a comment
const likeAndDislikeComment = async (
  commentId: string,
  userId: string,
): Promise<IProductComment> => {
  const comment = (await ProductComment.findById(commentId)) as IProductComment;

  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  const alreadyLiked = comment.likes.includes(userId);

  if (alreadyLiked) {
    comment.likes = comment.likes.filter(like => like !== userId);
  } else {
    comment.likes.push(userId);
  }

  await comment.save();
  return comment;
};

// const getMyProductComments = async (
//   user: JwtPayload,
//  ): Promise<IProductComment[]> => {
//   const products = await Product.find({ seller: user.userId }).select('_id');
//   const productIds = products.map(product => product._id);
//   const comments = await ProductComment.find({ product: { $in: productIds } })
//    .populate({
//     path: 'user',
//     select: '_id email profilePhoto name',
//    })
//    .populate({
//     path: 'replies.user',
//     select: '_id profilePhoto name',
//    }).populate({
//     path: 'product',
//     select: 'photos.mainPhoto title make model',
//    });

//   const modifiedComments = comments.map(comment => {
//    const isLiked = comment.likes.includes(user?.userId as string);
//    return {
//     ...comment.toObject(),
//     isLiked,
//    };
//   });

//   return modifiedComments;
//  };

// Get comments for a specific product
const getMyProductComments = async (
  productId: string,
  user?: JwtPayload,
): Promise<IProductComment[]> => {
  const comments = await ProductComment.find({ product: productId })
    .populate({
      path: 'user',
      select: '_id email profilePhoto name',
    })
    .populate({
      path: 'replies.user',
      select: '_id profilePhoto name',
    });

  const modifiedComments = comments.map(comment => {
    const isLiked = comment.likes.includes(user?.userId as string);
    return {
      ...comment.toObject(),
      isLiked,
    };
  });

  return modifiedComments;
};
const getSpecificProductComments = async (
  productId: string,
  user?: JwtPayload,
): Promise<IProductComment[]> => {
  const comments = await ProductComment.find({ product: productId })
    .populate({
      path: 'user',
      select: '_id email profilePhoto name',
    })
    .populate({
      path: 'replies.user',
      select: '_id profilePhoto name',
    });

  const modifiedComments = comments.map(comment => {
    const isLiked = comment.likes.includes(user?.userId as string);
    return {
      ...comment.toObject(),
      isLiked,
    };
  });

  return modifiedComments;
};
// get All product
const getAllProductComments = async (
  user?: JwtPayload,
): Promise<IProductComment[]> => {
  const comments = await ProductComment.find()
    .populate({
      path: 'user',
      select: '_id profilePhoto name email',
    })
    .populate({
      path: 'replies.user',
      select: '_id profilePhoto name email',
    })
    .populate({
      path: 'product',
      select: 'photos.mainPhoto title make model',
    });

  const modifiedComments = comments.map(comment => {
    const isLiked = comment.likes.includes(user?.userId as string);
    return {
      ...comment.toObject(),
      isLiked,
    };
  });

  return modifiedComments;
};

// Delete a product comment with authorization check
const deleteComment = async (
  commentId: string,
): Promise<IProductComment | null> => {
  const comment = await ProductComment.findById(commentId).lean();

  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Decrement the total comment count for the associated product
  await Product.findByIdAndUpdate(comment.product, {
    $inc: { totalComment: -1 },
  });

  // Delete and return the comment
  return await ProductComment.findByIdAndDelete(commentId);
};

export const ProductCommentService = {
  createComment,
  postCommentReply,
  likeAndDislikeComment,
  getMyProductComments,
  getAllProductComments,
  deleteComment,
  getSpecificProductComments,
};
