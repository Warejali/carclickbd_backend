import { SortOrder, startSession } from 'mongoose';
import { paginationHelpers } from '../../../helper/paginationHelper';
import { IPaginationOptions } from '../../../inerfaces/pagination';
import { IGenericResponse } from '../../../shared/sendResponse';
import { IUser, IUserFilters } from '../user/user.interface';
import { User } from '../user/user.model';
import { userSearchableFields } from './user.constant';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import { AuthService } from '../auth/auth.service';
import { IUploadFile } from '../../../inerfaces/file';
import { FileUploadHelper } from '../../../helper/FileUploadHelper';
import { JwtPayload } from 'jsonwebtoken';
import { ILoginUserResponse } from '../auth/auth.interface';

const createUser = async (payload: IUser): Promise<IUser> => {
  const isNotUniqueEmail = await User.isUserExist(payload.email);
  if (isNotUniqueEmail) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Sorry, this email address is already in use.',
    );
  }

  const session = await startSession();
  session.startTransaction();

  try {
    const user = await User.create(payload);
    await AuthService.sendVerificationEmail({ email: user?.email });
    return user;
    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllUser = async (
  filters: IUserFilters,
  paginationOptions: IPaginationOptions,
): Promise<IGenericResponse<IUser[]>> => {
  const { searchTerm, ...filtersData } = filters;
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOptions);

  const andConditions = [];
  if (searchTerm) {
    andConditions.push({
      $or: userSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }
  if (Object.keys(filtersData).length) {
    andConditions.push({
      $and: Object.entries(filtersData).map(([field, value]) => ({
        [field]: value,
      })),
    });
  }

  const sortConditions: { [key: string]: SortOrder } = {};
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }
  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  const result = await User.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

const getAllAdmin = async (
  filters: IUserFilters,
  paginationOptions: IPaginationOptions,
): Promise<IGenericResponse<IUser[]>> => {
  const { searchTerm, ...filtersData } = filters;
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOptions);

  const andConditions: any[] = [];
  andConditions.push({ role: { $in: ['admin', 'super-admin'] } });
  if (searchTerm) {
    andConditions.push({
      $or: userSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }

  if (Object.keys(filtersData).length) {
    Object.entries(filtersData).forEach(([field, value]) => {
      andConditions.push({ [field]: value });
    });
  }
  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};
  const sortConditions: { [key: string]: SortOrder } = {};
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }

  const result = await User.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit);
  const total = await User.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};
const getAllSeller = async (
  filters: IUserFilters,
  paginationOptions: IPaginationOptions,
): Promise<IGenericResponse<IUser[]>> => {
  const { searchTerm, ...filtersData } = filters;
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOptions);

  const andConditions: any[] = [];
  andConditions.push({ role: 'seller' });

  if (searchTerm) {
    andConditions.push({
      $or: userSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }

  if (Object.keys(filtersData).length) {
    Object.entries(filtersData).forEach(([field, value]) => {
      andConditions.push({ [field]: value });
    });
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  const sortConditions: { [key: string]: SortOrder } = {};
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }

  const result = await User.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit);
  const total = await User.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};
const getAllCustomer = async (
  filters: IUserFilters,
  paginationOptions: IPaginationOptions,
): Promise<IGenericResponse<IUser[]>> => {
  const { searchTerm, ...filtersData } = filters;
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOptions);

  const andConditions: any[] = [];
  andConditions.push({ role: 'customer' });

  if (searchTerm) {
    andConditions.push({
      $or: userSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }

  if (Object.keys(filtersData).length) {
    Object.entries(filtersData).forEach(([field, value]) => {
      andConditions.push({ [field]: value });
    });
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  const sortConditions: { [key: string]: SortOrder } = {};
  if (sortBy && sortOrder) {
    sortConditions[sortBy] = sortOrder;
  }

  const result = await User.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit);
  const total = await User.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

const getOneUser = async (id: string): Promise<IUser | null> => {
  const result = await User.findById(id);
  return result;
};

const updateUser = async (
  user: JwtPayload,
  payload?: Partial<IUser>,
  file?: IUploadFile,
): Promise<IUser | null> => {
  const { role, password, email, ...sanitizedPayload } = payload || {};
  if (email || password || role) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Updating email or password or role is not allowed through this endpoint',
    );
  }

  let url;
  try {
    const isUserExist = await User.isUserExist(user.email);
    if (!isUserExist) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (file) {
      url = await FileUploadHelper.uploadSingleImage(file);
    }
    const updatedUserData = {
      ...sanitizedPayload,
      ...(url && { profilePhoto: url }),
    };

    const result = await User.findByIdAndUpdate(user?.userId, updatedUserData, {
      new: true,
    });

    return result;
  } catch (error) {
    if (url) {
      await FileUploadHelper.deleteImageByUrl(url);
    }
    throw error;
  }
};

const toggleUserStatus = async (userId: string): Promise<IUser | null> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.isDisabled = !user.isDisabled;
  await user.save();

  return user;
};
const downgradeMembership = async (userId: string): Promise<IUser | null> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.membership = 'basic';
  await user.save();

  return user;
};

const convertCustomerToPersonalSeller = async (
  user: JwtPayload,
): Promise<ILoginUserResponse> => {
  const existingUser = await User.findById(user.userId);
  if (!existingUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (existingUser.isDisabled) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Disabled account cannot be converted',
    );
  }

  if (existingUser.role !== 'customer') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Only buyer/customer accounts can be converted to a personal seller account',
    );
  }

  existingUser.role = 'seller';
  existingUser.sellerType = 'personal';
  existingUser.accountType = 'personal';
  await existingUser.save();

  return AuthService.createLoginResponseForUser(existingUser._id as string);
};

const deleteUser = async (id: string): Promise<void> => {
  const isExist = await User.findById(id);

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found!');
  }

  await User.findByIdAndDelete(id);
};

export const UserService = {
  getAllUser,
  getOneUser,
  updateUser,
  createUser,
  deleteUser,
  toggleUserStatus,
  getAllAdmin,
  getAllCustomer,
  getAllSeller,
  downgradeMembership,
  convertCustomerToPersonalSeller,
};
