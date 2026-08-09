import { JwtPayload } from 'jsonwebtoken';
import ApiError from '../../../../errors/ApiError';
import { IWatchlist } from './watchlist.interface';
import Watchlist from './watchlist.model';
import httpStatus from 'http-status';

// Add product to watchlist
const addToWatchlist = async (
  payload: IWatchlist,
  user: JwtPayload,
): Promise<{ action: 'added' | 'removed'; watchlist: IWatchlist | null }> => {
  // Check if already in watchlist
  const exists = await Watchlist.findOne({
    user: user.userId,
    product: payload.product,
  });
  if (exists) {
    // throw new ApiError(httpStatus.BAD_REQUEST, 'Product already in watchlist');
    const deletedWatchlistItem = await Watchlist.findOneAndDelete({
      user: user.userId,
      product: payload.product,
    });
    // console.log('deletedWatchlistItem', deletedWatchlistItem);

    return {
      action: 'removed',
      watchlist: deletedWatchlistItem as IWatchlist,
    };
  }

  const watchlist = await Watchlist.create(payload);

  return {
    action: 'added',
    watchlist,
  };
};

// Remove product from watchlist
const removeFromWatchlist = async (
  productId: string,
  user: JwtPayload,
): Promise<IWatchlist | null> => {
  const watchlistItem = await Watchlist.findOneAndDelete({
    user: user.userId,
    product: productId,
  });

  if (!watchlistItem) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Item not found in watchlist');
  }

  return watchlistItem;
};

// Get user's watchlist
const getUserWatchlist = async (userId: string): Promise<IWatchlist[]> => {
  return await Watchlist.find({ user: userId }).populate('product');
};

export const WatchlistService = {
  addToWatchlist,
  removeFromWatchlist,
  getUserWatchlist,
};
