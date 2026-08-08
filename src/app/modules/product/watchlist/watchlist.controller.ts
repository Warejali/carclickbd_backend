import { Request, Response } from 'express';
import catchAsync from '../../../../shared/catchAsync';
import { WatchlistService } from './watchlist.service';
import { JwtPayload } from 'jsonwebtoken';
import sendResponse from '../../../../shared/sendResponse';
import httpStatus from 'http-status';
import { IWatchlist } from './watchlist.interface';

// Controller to add a product to the watchlist
const addToWatchlist = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const payload = { ...req.body, user: userId };

  const result = await WatchlistService.addToWatchlist(
    payload,
    req.user as JwtPayload,
  );

  sendResponse<{ action: 'added' | 'removed'; watchlist: IWatchlist | null }>(
    res,
    {
      statusCode:
        result.action === 'added' ? httpStatus.CREATED : httpStatus.OK,
      success: true,
      message:
        result.action === 'added'
          ? 'Product added to watchlist successfully!'
          : 'Product removed from watchlist successfully!',
      data: result,
    },
  );
});

// Controller to remove a product from the watchlist
const removeFromWatchlist = catchAsync(async (req: Request, res: Response) => {
  const { id: productId } = req.params;
  const user = req.user as JwtPayload;

  const result = await WatchlistService.removeFromWatchlist(productId, user);

  sendResponse<IWatchlist>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product removed from watchlist successfully!',
    data: result,
  });
});

// Controller to get the user's watchlist
const getUserWatchlist = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;

  const result = await WatchlistService.getUserWatchlist(userId);

  sendResponse<IWatchlist[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Watchlist fetched successfully!',
    data: result,
  });
});

export const WatchlistController = {
  addToWatchlist,
  removeFromWatchlist,
  getUserWatchlist,
};
