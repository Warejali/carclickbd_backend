import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { IUser } from '../user/user.interface';
import sendResponse from '../../../shared/sendResponse';
import httpStatus from 'http-status';
import { UserService } from './user.service';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../constant/pagination';
import { userFilterableFields } from './user.constant';
import { IUploadFile } from '../../../inerfaces/file';
import { JwtPayload } from 'jsonwebtoken';
import { ILoginUserResponse } from '../auth/auth.interface';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.createUser(req.body);

  sendResponse<IUser>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'user created successfully !',
    data: result,
  });
});

const getAllUser = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const paginationOptions = pick(req.query, paginationFields);

  const result = await UserService.getAllUser(filters, paginationOptions);

  sendResponse<IUser[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'user fetched successfully !',
    meta: result.meta,
    data: result.data,
  });
});
const getAllAdmin = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const paginationOptions = pick(req.query, paginationFields);

  const result = await UserService.getAllAdmin(filters, paginationOptions);

  sendResponse<IUser[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'admin fetched successfully !',
    meta: result.meta,
    data: result.data,
  });
});
const getAllSeller = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const paginationOptions = pick(req.query, paginationFields);

  const result = await UserService.getAllSeller(filters, paginationOptions);

  sendResponse<IUser[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'seller fetched successfully !',
    meta: result.meta,
    data: result.data,
  });
});
const getAllCustomer = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const paginationOptions = pick(req.query, paginationFields);

  const result = await UserService.getAllCustomer(filters, paginationOptions);

  sendResponse<IUser[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'seller fetched successfully !',
    meta: result.meta,
    data: result.data,
  });
});

const getOneUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const result = await UserService.getOneUser(id);

  sendResponse<IUser>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'user fatched successfully !',
    data: result,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  let data = {};
  if (req.body?.data) {
    data = JSON.parse(req.body?.data);
  }
  const file = req.file;
  const user = req.user as JwtPayload;

  const result = await UserService.updateUser(user, data, file as IUploadFile);

  sendResponse<IUser>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'user updated successfully !',
    data: result,
  });
});

const toggleUserStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.toggleUserStatus(id);

  sendResponse<IUser>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'user updated successfully !',
    data: result,
  });
});
const downgradeMembership = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.downgradeMembership(id);

  sendResponse<IUser>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'downgrade successfully !',
    data: result,
  });
});

const convertToPersonalSeller = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload;
    const result = await UserService.convertCustomerToPersonalSeller(user);

    sendResponse<ILoginUserResponse>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Account converted to personal seller successfully!',
      data: {
        accessToken: result.token?.accessToken || result.accessToken,
        user: result.user,
      },
    });
  },
);

const deleteUserByadmin = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  await UserService.deleteUser(id);

  sendResponse<void>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'user deleted successfully !',
    data: null,
  });
});

export const UserController = {
  getAllUser,
  getOneUser,
  updateUser,
  createUser,
  deleteUserByadmin,
  toggleUserStatus,
  getAllAdmin,
  getAllSeller,
  getAllCustomer,
  downgradeMembership,
  convertToPersonalSeller,
};
