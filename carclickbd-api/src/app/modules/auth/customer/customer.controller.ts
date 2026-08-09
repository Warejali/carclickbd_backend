import { Request, Response } from 'express';
import httpStatus from 'http-status';
import config from '../../../../config';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { ILoginUserResponse } from '../auth.interface';
import { CustomerService } from './customer.service';

const customerRegistration = catchAsync(async (req: Request, res: Response) => {
  const { ...userData } = req.body;
  // await AuthService.sendEmailVerificationMail(userData.email);
  const result = await CustomerService.customerRegistration(userData);
  const { token, user } = result;

  const cookieOptions = {
    secure: config.env === 'production',
    httpOnly: true,
  };

  res.cookie('refreshToken', token?.refreshToken, cookieOptions);

  sendResponse<ILoginUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User Registration in successfully !',
    data: {
      accessToken: token?.accessToken,
      user,
    },
  });
});

export const CustomerController = {
  customerRegistration,
};
