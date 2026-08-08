import { IUser } from '../../user/user.interface';
import { User } from '../../user/user.model';
import { AuthService } from '../auth.service';
import { startSession } from 'mongoose';
import ApiError from '../../../../errors/ApiError';
import httpStatus from 'http-status';
import { ILoginUserResponse } from '../auth.interface';

const customerRegistration = async (
  payload: IUser,
): Promise<ILoginUserResponse> => {
  const normalizedPayload = {
    ...payload,
    role: 'customer',
    contactNo: payload.contactNo || payload.whatsappNumber,
    whatsappNumber: payload.whatsappNumber || payload.contactNo,
    address: payload.address || payload.showroomOfficeAddress,
    showroomOfficeAddress: payload.showroomOfficeAddress || payload.address,
  } as IUser;

  const { isEmailVerified, ...userPayload } = normalizedPayload;

  if (isEmailVerified) {
    throw new ApiError(
      httpStatus.EXPECTATION_FAILED,
      'not accept any unknown  property.',
    );
  }

  const isNotUniqueEmail = await User.isUserExist(normalizedPayload.email);
  if (isNotUniqueEmail) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Sorry, this email address is already in use.',
    );
  }

  const session = await startSession();
  session.startTransaction();

  try {
    await User.create(userPayload);

    // await AuthService.sendVerificationEmail({
    //   email: user?.email,
    //   name: user?.name as string,
    // });

    const loginData = {
      email: normalizedPayload.email,
      password: normalizedPayload.password,
    };
    const result = await AuthService.userLogin(loginData);
    return result;

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const CustomerService = {
  customerRegistration,
};
