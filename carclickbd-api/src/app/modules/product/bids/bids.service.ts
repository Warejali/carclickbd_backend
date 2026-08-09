import httpStatus from 'http-status';
import ApiError from '../../../../errors/ApiError';
import { Product } from '../product.model';
import { IBid, IBidFilterableField } from './bids.interface';
import { Bid } from './bids.model';
import { IProduct } from '../product.interface';
import { SortOrder, startSession, Types } from 'mongoose';
import { IPaginationOptions } from '../../../../inerfaces/pagination';
import { IGenericResponse } from '../../../../shared/sendResponse';
import { paginationHelpers } from '../../../../helper/paginationHelper';
import { bidSearchableFields } from './bid.constant';
import { Notification } from '../../notification/notification.model';

// const createBid = async (payload: IBid): Promise<IBid> => {
//   const session = await startSession();
//   session.startTransaction();

//   try {
//     const { product, bidAmount, user } = payload;

//     const productExist = await Product.findById(product).session(session);
//     if (!productExist) {
//       throw new ApiError(
//         httpStatus.NOT_FOUND,
//         'The product you are trying to bid on does not exist.'
//       );
//     }

//     const { minBid, endBid, startBid } = productExist;

//     if (new Date() > new Date(endBid)) {
//       throw new ApiError(httpStatus.BAD_REQUEST, 'The bidding has already ended.');
//     }

//     if (new Date() < new Date(startBid)) {
//       throw new ApiError(httpStatus.BAD_REQUEST, 'The bidding has not started yet.');
//     }

//     const highestBid = await Bid.findOne({ product }).sort({ bidAmount: -1 }).session(session);
//     const userBid = await Bid.findOne({ product, user }).session(session); // Check if user already placed a bid

//     if (
//       (!highestBid && Number(bidAmount) <= Number(minBid)) ||
//       (highestBid && Number(bidAmount) <= Number(highestBid.bidAmount))
//     ) {
//       const message = highestBid
//         ? `Your bid must exceed the current highest bid of ${highestBid.bidAmount}.`
//         : `Your bid must be at least the minimum bid of ${minBid}.`;

//       throw new ApiError(httpStatus.BAD_REQUEST, message);
//     }

//     let updatedBid: IBid;

//     if (userBid) {
//       // Update existing bid
//       userBid.bidAmount = bidAmount;
//       await userBid.save({ session });
//       updatedBid = userBid;
//     } else {
//       // Create a new bid
//       const newBid = await Bid.create([payload], { session });
//       updatedBid = newBid[0];

//       // Increment totalBids only for new bids
//       await Product.updateOne(
//         { _id: product },
//         { $inc: { "totalBids": 1 } },
//         { session }
//       );
//     }

//     // Update highest bid
//     await Product.updateOne(
//       { _id: product },
//       { $set: { highestBid: bidAmount } },
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return updatedBid;
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

// Import Notification model

// const createBid = async (payload: IBid): Promise<IBid> => {
//   const session = await startSession();
//   session.startTransaction();

//   try {
//     const { product, bidAmount, user } = payload;

//     const productExist = await Product.findById(product).session(session);
//     if (!productExist) {
//       throw new ApiError(
//         httpStatus.NOT_FOUND,
//         'The product you are trying to bid on does not exist.'
//       );
//     }

//     const { minBid, endBid, startBid } = productExist;

//     if (new Date() > new Date(endBid)) {
//       throw new ApiError(httpStatus.BAD_REQUEST, 'The bidding has already ended.');
//     }

//     if (new Date() < new Date(startBid)) {
//       throw new ApiError(httpStatus.BAD_REQUEST, 'The bidding has not started yet.');
//     }

//     const highestBid = await Bid.findOne({ product }).sort({ bidAmount: -1 }).session(session);
//     const userBid = await Bid.findOne({ product, user }).session(session);

//     if (
//       (!highestBid && Number(bidAmount) <= Number(minBid)) ||
//       (highestBid && Number(bidAmount) <= Number(highestBid.bidAmount))
//     ) {
//       const message = highestBid
//         ? `Your bid must exceed the current highest bid of ${highestBid.bidAmount}.`
//         : `Your bid must be at least the minimum bid of ${minBid}.`;

//       throw new ApiError(httpStatus.BAD_REQUEST, message);
//     }

//     let updatedBid: IBid;

//     if (userBid) {
//       // Update existing bid
//       userBid.bidAmount = bidAmount;
//       await userBid.save({ session });
//       updatedBid = userBid;
//     } else {
//       // Create a new bid
//       const newBid = await Bid.create([payload], { session });
//       updatedBid = newBid[0];

//       // Increment totalBids only for new bids
//       await Product.updateOne(
//         { _id: product },
//         { $inc: { totalBids: 1 } },
//         { session }
//       );
//     }

//     // Update highest bid
//     await Product.updateOne(
//       { _id: product },
//       { $set: { highestBid: bidAmount } },
//       { session }
//     );

//     // Find all previous bidders (except the current bidder)
//     const previousBidders = await Bid.find({ product, user: { $ne: user } }).distinct("user").session(session);

//     if (previousBidders.length > 0) {
//       // Create notifications for previous bidders
//       const notifications = previousBidders.map(bidder => ({
//         user: bidder,
//         product: product,
//         message: `A new bid of ${bidAmount} has been placed on ${productExist.title}.`,
//         status: 'unread',
//       }));

//       // Save notifications in the database
//       await Notification.insertMany(notifications, { session });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return updatedBid;
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

const createBid = async (payload: IBid): Promise<IBid> => {
  const session = await startSession();
  session.startTransaction();

  try {
    const { product, bidAmount, user } = payload;

    const productExist = await Product.findById(product).session(session);
    if (!productExist) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'The product you are trying to bid on does not exist.',
      );
    }

    const { minBid, endBid, startBid } = productExist;
    const productName = [productExist.maker, productExist.model]
      .filter(Boolean)
      .join(' ');

    if (!endBid) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'The bidding end date is not set.',
      );
    }
    if (new Date() > new Date(endBid)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'The bidding has already ended.',
      );
    }

    if (!startBid) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'The bidding start date is not set.',
      );
    }
    if (new Date() < new Date(startBid)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'The bidding has not started yet.',
      );
    }

    const highestBid = await Bid.findOne({ product })
      .sort({ bidAmount: -1 })
      .session(session);
    const userBid = await Bid.findOne({ product, user }).session(session);

    // ✅ Fix: Use `const` instead of `let`
    const previousHighestBidderId: Types.ObjectId | null = highestBid
      ? highestBid.user
      : null;

    if (
      (!highestBid && Number(bidAmount) <= Number(minBid)) ||
      (highestBid && Number(bidAmount) <= Number(highestBid.bidAmount))
    ) {
      const message = highestBid
        ? `Your bid must exceed the current highest bid of ${highestBid.bidAmount}.`
        : `Your bid must be at least the minimum bid of ${minBid}.`;

      throw new ApiError(httpStatus.BAD_REQUEST, message);
    }

    let updatedBid: IBid;

    if (userBid) {
      // Update existing bid
      userBid.bidAmount = bidAmount;
      await userBid.save({ session });
      updatedBid = userBid;
    } else {
      // Create a new bid
      const newBid = await Bid.create([payload], { session });
      updatedBid = newBid[0];

      // Increment totalBids only for new bids
      await Product.updateOne(
        { _id: product },
        { $inc: { totalBids: 1 } },
        { session },
      );
    }

    // Update highest bid and save previous highest bidder
    await Product.updateOne(
      { _id: product },
      {
        $set: {
          highestBid: bidAmount,
          previousHighestBidder: previousHighestBidderId, // ✅ Store previous highest bidder
        },
      },
      { session },
    );

    // Find all previous bidders (except the current bidder)
    const previousBidders = await Bid.find({ product, user: { $ne: user } })
      .distinct('user')
      .session(session);

    if (previousBidders.length > 0) {
      const message = `A new bid of ${bidAmount} has been placed on ${productName}.`;
      // Create notifications for previous bidders
      const notifications = previousBidders.map(bidder => ({
        user: bidder,
        product: product,
        message: message,
        overBid: bidAmount,
        itemName: productName,
        status: 'unread',
      }));
      await Notification.insertMany(notifications, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return updatedBid;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllBids = async (
  paginationOption: IPaginationOptions,
  filters: IBidFilterableField,
): Promise<IGenericResponse<IProduct[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOption);

  const { searchTerm, endingSoon, newlyListed, ...filterData } = filters;

  const andConditions = [];
  if (searchTerm) {
    andConditions.push({
      $or: bidSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push({
      $and: Object.entries(filterData).map(([field, value]) => ({
        [field]: value,
      })),
    });
  }

  const thresholdDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  const currentDate = new Date();

  andConditions.push({
    endBid: { $gt: currentDate },
  });

  andConditions.push({
    $and: [
      { startBid: { $lte: currentDate } },
      { endBid: { $gt: currentDate } },
    ],
  });
  if (endingSoon) {
    // console.log('ending soon');
    andConditions.push({
      endBid: { $lte: thresholdDate },
    });
  }

  const sortConditions: { [key: string]: SortOrder } = {};

  if (newlyListed) {
    sortConditions['createdAt'] = -1;
  } else if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  const products = await Product.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'seller',
      select: '_id profilePhoto name',
    });

  const total = await Product.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: products,
  };
};

const getSpecificProductBids = async (
  productId: string,
): Promise<IBid[] | null> => {
  const bids = await Bid.find({ product: productId })
    .populate({
      path: 'user',
      select: 'email',
    })
    .populate({
      path: 'product',
      select: 'title',
    })
    .lean();

  const highestBid =
    bids?.sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]
      ?.bidAmount || 0;

  const allBids = bids?.map(bid => ({ ...bid, highestBid })) || [];

  return allBids;
};

// const getAllProductBids = async (): Promise<IProduct[] | null> => {
//   const products = await Product.find({}).select(
//     'photos.mainPhoto title model make bidInfo _id',
//   );

//   const currentTime = new Date();

//   const modifiedProducts = await Promise.all(
//     products.map(async product => {
//       const productObj = product.toObject();
//       const bids = await BidService.getSpecificProductBids(
//         product._id.toString(),
//       );

//       const highestBidder = findHighestBidder(bids);
//       const endBidTime = new Date(productObj.endBid);
//       const isBiddingEnded = currentTime >= endBidTime;

//       productObj.highestBid = calculateHighestBid(bids);
//       productObj.highestBidder = highestBidder;
//       productObj.winner = assignWinner(isBiddingEnded, highestBidder);

//       return productObj;
//     }),
//   );

//   return modifiedProducts;
// };

const getMyBid = async (
  userId: string,
  filters: IBidFilterableField,
): Promise<IBid[] | null> => {
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      $or: bidSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    Object.entries(filterData).forEach(([field, value]) => {
      andConditions.push({ [field]: value });
    });
  }

  if (userId) {
    andConditions.push({ user: userId });
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  const bids = await Bid.find(whereConditions)
    .populate({
      path: 'user',
      select: 'email',
    })
    .populate({
      path: 'product',
      select: 'photos.mainPhoto title endBid',
    })
    .lean();

  const highestBid =
    bids?.sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]
      ?.bidAmount || 0;

  const myBids = bids?.map(bid => ({ ...bid, highestBid })) || [];

  return myBids;
};

// const getMyBid = async (user: JwtPayload): Promise<IBid[] | null> => {
//   const userBids = await Bid.find({ user: user.userId }).populate({
//     path: 'product',
//     select: 'photos.mainPhoto title make model endBid launchingYear ',
//   });

//   if (!userBids) return null;
//   const highestBidsMap = new Map<string, IBid>();

//   const now = new Date();

//   userBids.forEach(bid => {
//     const product = bid.product as any;
//     const biddingDuration = product?.endBid;
//     if (biddingDuration && new Date(biddingDuration) < now) {
//       return;
//     }

//     const productId = product._id;

//     if (
//       !highestBidsMap.has(productId) ||
//       parseFloat(bid.bidAmount) >
//         parseFloat(highestBidsMap.get(productId)!.bidAmount)
//     ) {
//       highestBidsMap.set(productId, bid);
//     }
//   });

//   return Array.from(highestBidsMap.values());
// };

export const BidService = {
  createBid,
  getSpecificProductBids,
  getMyBid,
  getAllBids,
};
