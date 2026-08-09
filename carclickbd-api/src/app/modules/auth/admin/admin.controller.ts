import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../../shared/catchAsync';
import sendResponse from '../../../../shared/sendResponse';
import { AdminService } from './admin.service';
import { IUser } from '../../user/user.interface';

// user registration with login
const adminRegistration = catchAsync(async (req: Request, res: Response) => {
  const { ...userData } = req.body;
  const result = (await AdminService.adminRegistration(userData)) as IUser;

  sendResponse<IUser>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'admin Registration  successfully !',
    data: result,
  });
});

export const AdminController = {
  adminRegistration,
};
