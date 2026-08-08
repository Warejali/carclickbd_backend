import httpStatus from 'http-status';
import { IOtp } from './otp.interface';
import { OTP } from './otp.model';
import ApiError from '../../../../errors/ApiError';

// get OTP
export const getOTP = async (email: string): Promise<IOtp> => {
  // Generate a 6-digit numeric OTP (range 100000 - 999999)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const otpRecord = new OTP({
    email,
    otp,
    expiresAt,
  });

  console.log('getOTP', otpRecord);
  const result = await otpRecord.save();
  console.log('result', result);
  return result;
};

// verifiy OTP
export const verifyOtp = async (email: string, otp: string) => {
  // console.log(email, otp);
  const otpRecord = await OTP.findOne({ email: email, otp: otp });
  // console.log('otpRecord', otpRecord);

  // Check if OTP exists and is still valid
  if (!otpRecord) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid OTP');
  }

  // Check if OTP has expired
  if (new Date() > otpRecord.expiresAt) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'OTP has expired.Please try again',
    );
  }
};
