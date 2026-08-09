import { Request, Response } from 'express';
import catchAsync from '../../../../shared/catchAsync';

import sendResponse from '../../../../shared/sendResponse';
import { IBid, IBidFilterableField } from './bids.interface';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import { BidService } from './bids.service';
import { paginationFields } from '../../../../constant/pagination';
import pick from '../../../../shared/pick';
import { productFilterableFields } from '../product.constant';
import { bidFilterableFields } from './bid.constant';

const createBid = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user as JwtPayload;
  const readyPayload = { ...payload, user: user.userId };
  const result = await BidService.createBid(readyPayload);
  sendResponse<IBid>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Bid created successfully!',
    data: result,
  });
});

const getSellerProductBids = catchAsync(async (req: Request, res: Response) => {
  const { id: productId } = req.params;
  // const user = req.user as JwtPayload;
  const result = await BidService.getSpecificProductBids(productId);
  sendResponse<IBid[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bids fetched successfully!',
    data: result,
  });
});
const getSpecificProductBids = catchAsync(
  async (req: Request, res: Response) => {
    const { id: productId } = req.params;
    const result = await BidService.getSpecificProductBids(productId);
    sendResponse<IBid[]>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Bids fetched successfully!',
      data: result,
    });
  },
);

const getAllProductBids = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const paginationOption = pick(query, paginationFields);
  const filters = pick(
    query,
    productFilterableFields,
  ) as unknown as IBidFilterableField;

  const result = await BidService.getAllBids(paginationOption, filters); // ✅ fixed argument order

  sendResponse<IBid[] | any>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bids fetched successfully!',
    data: result,
  });
});

const getMyBid = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const query = req.query;
  const filters = pick(
    query,
    bidFilterableFields,
  ) as unknown as IBidFilterableField;

  const result = await BidService.getMyBid(user.userId, filters);
  sendResponse<IBid[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Bids fetched successfully!',
    data: result,
  });
});

export const BidController = {
  createBid,
  getSellerProductBids,
  getMyBid,
  getAllProductBids,
  getSpecificProductBids,
};
