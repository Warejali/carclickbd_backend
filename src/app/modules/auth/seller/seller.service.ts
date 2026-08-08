import { IUser } from '../../user/user.interface';
import { User } from '../../user/user.model';
import { AuthService } from '../auth.service';
import { startSession } from 'mongoose';
import ApiError from '../../../../errors/ApiError';
import httpStatus from 'http-status';
import { ILoginUserResponse } from '../auth.interface';

const sellerRegistration = async (
  payload: IUser,
): Promise<ILoginUserResponse> => {
  const sellerType =
    payload.sellerType === 'dealer' || payload.accountType === 'dealer'
      ? 'dealer'
      : 'personal';
  const normalizedPayload = {
    ...payload,
    sellerType,
    accountType: sellerType,
    contactNo: payload.contactNo || payload.whatsappNumber,
    whatsappNumber: payload.whatsappNumber || payload.contactNo,
    address: payload.address || payload.showroomOfficeAddress,
    showroomOfficeAddress: payload.showroomOfficeAddress || payload.address,
  } as IUser;
  const { isEmailVerified, ...userPayload } = normalizedPayload;

  if (isEmailVerified) {
    throw new ApiError(
      httpStatus.EXPECTATION_FAILED,
      'not accept any balance property.',
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
    const newSeller = await User.create([{ ...userPayload, role: 'seller' }], {
      session,
    });
    // await AuthService.sendVerificationEmail({ email: newSeller[0].email });
    await session.commitTransaction();
    session.endSession();
    return AuthService.createLoginResponseForUser(newSeller[0]._id as string);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const AdminService = {
  sellerRegistration,
};
