import { Request, Response } from 'express';
import httpStatus from 'http-status';
import config from '../../../../config';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { AdminService } from './seller.service';
import { ILoginUserResponse } from '../auth.interface';

// user registration with login
const sellerRegistration = catchAsync(async (req: Request, res: Response) => {
  const { ...userData } = req.body;
  const result = await AdminService.sellerRegistration(userData);
  const { token, user } = result;

  res.cookie('refreshToken', token?.refreshToken, {
    secure: config.env === 'production',
    httpOnly: true,
  });

  sendResponse<ILoginUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Seller Registration  successfully !',
    data: {
      accessToken: token?.accessToken,
      user,
    },
  });
});

export const SellerController = {
  sellerRegistration,
};
