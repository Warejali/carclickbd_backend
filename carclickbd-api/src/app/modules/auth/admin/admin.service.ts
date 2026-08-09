import { IUser } from '../../user/user.interface';
import { User } from '../../user/user.model';
import { AuthService } from '../auth.service';
import { startSession } from 'mongoose';
import ApiError from '../../../../errors/ApiError';
import httpStatus from 'http-status';

const adminRegistration = async (payload: IUser): Promise<IUser> => {
  const { isEmailVerified, ...userPayload } = payload;

  if (isEmailVerified) {
    throw new ApiError(
      httpStatus.EXPECTATION_FAILED,
      'Not accepting any predefined email verification status.',
    );
  }

  // Check if email is already in use
  const isEmailExists = await User.isUserExist(payload.email);
  if (isEmailExists) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Sorry, this email address is already in use.',
    );
  }

  const session = await startSession();
  session.startTransaction();

  try {
    const newAdmin = await User.create([{ ...userPayload, role: 'admin' }], {
      session,
    });
    await AuthService.sendVerificationEmail({ email: newAdmin[0].email });
    await session.commitTransaction();
    session.endSession();

    return newAdmin[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const AdminService = {
  adminRegistration,
};
