/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { jwtHelpers } from '../../../helper/jwtHelpers';
import {
  convertHashPassword,
  verifyPassword,
} from '../../../helper/passwordSecurityHelper';
import { sendMailerHelper } from '../../../helper/sendMailHelper';
// import validationResponse from '../../../shared/validationResponse';
// import { IUser } from '../user/user.interface';
import { User } from '../user/user.model';
import {
  IAuthMessage,
  IChangeEmail,
  IChangePassword,
  IForgetPassword,
  ILoginUser,
  ILoginUserResponse,
  IRefreshTokenResponse,
  IResetPassword,
} from './auth.interface';
import { getOTP, verifyOtp } from './otp/otp.service';

// login user
const userLogin = async (payload: ILoginUser): Promise<ILoginUserResponse> => {
  const { email, password } = payload;

  // Check if user exists
  const user = await User.findOne({ email }).select('+password'); // Ensure password field is included

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Invalid email or password. Please check your credentials and try again.',
    );
  }

  // Check if user is disabled
  if (user.isDisabled) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Your account is disabled. Please contact support for assistance.',
    );
  }

  // Check if the password matches
  const isPasswordMatched = await User.isPasswordMatched(
    password,
    user.password,
  );
  if (!isPasswordMatched) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'Incorrect password. Please try again.',
    );
  }

  // Destructure required fields
  const { _id, role, email: Email, isEmailVerified } = user;

  // Generate JWT tokens
  const tokenPayload: Record<string, any> = {
    userId: _id,
    role,
    email: Email,
    isEmailVerified,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.accessTokenSecret as Secret,
    config.jwt.accessTokenExpireIn as string,
  );

  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refreshTokenSecret as Secret,
    config.jwt.refreshTokenExpireIn as string,
  );

  return {
    token: { accessToken, refreshToken },
    user,
  };
};

const createLoginResponseForUser = async (
  userId: string,
): Promise<ILoginUserResponse> => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
  }

  if (user.isDisabled) {
    throw new ApiError(httpStatus.FORBIDDEN, 'This user account is disabled.');
  }

  const { _id, role, email, isEmailVerified } = user;
  const tokenPayload: Record<string, any> = {
    userId: _id,
    role,
    email,
    isEmailVerified,
  };

  const accessToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.accessTokenSecret as Secret,
    config.jwt.accessTokenExpireIn as string,
  );

  const refreshToken = jwtHelpers.createToken(
    tokenPayload,
    config.jwt.refreshTokenSecret as Secret,
    config.jwt.refreshTokenExpireIn as string,
  );

  return {
    token: { accessToken, refreshToken },
    user,
  };
};

const impersonateUser = async (
  adminUser: JwtPayload | null,
  targetUserId: string,
): Promise<ILoginUserResponse> => {
  const requesterRole = adminUser?.role;

  if (!['admin', 'super-admin'].includes(requesterRole)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only admin and super admin can log in as another user.',
    );
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
  }

  if (targetUser.isDisabled) {
    throw new ApiError(httpStatus.FORBIDDEN, 'This user account is disabled.');
  }

  if (
    requesterRole === 'admin' &&
    ['admin', 'super-admin'].includes(targetUser.role)
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only super admin can log in as an admin account.',
    );
  }

  return createLoginResponseForUser(targetUserId);
};

// is user exist
const isUserExist = async (payload: { email: string }): Promise<any> => {
  const { email } = payload;

  // Check if the user exists
  const isUserExist = await User.isUserExist(email);
  if (!isUserExist) {
    return { isUserExist: false };
  } else if (isUserExist) {
    return { isUserExist: true };
  }
};

// refresh Token
const getNewAccessToken = async (
  token: string,
): Promise<IRefreshTokenResponse> => {
  try {
    // Verify token
    const verifiedToken = jwtHelpers.verifyToken(
      token,
      config.jwt.refreshTokenSecret as Secret,
    );

    const { email } = verifiedToken;

    // Check if user exists
    const isUserExist = await User.isUserExist(email);
    if (!isUserExist) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');
    }

    // Generate new token
    const newAccessToken = jwtHelpers.createToken(
      {
        userId: isUserExist._id,
        role: isUserExist.role,
        email: isUserExist.email,
      },
      process.env.JWT_ACCESSTOKEN_SECRET as Secret, // Ensure correct secret
      process.env.JWT_ACCESSTOKEN_EXPIRE || '60s', // Ensure correct format
    );

    return {
      accessToken: newAccessToken,
    };
  } catch (err) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Invalid or Expired Refresh Token',
    );
  }
};

// Change Password
const changePassword = async (
  user: JwtPayload | null,
  payload: IChangePassword,
): Promise<any> => {
  const { oldPassword, newPassword } = payload;

  // Find the user by ID and include the password field
  const isUserExist = await User.isUserExist(user?.email);

  if (!isUserExist) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Sorry.User does not exist');
  }

  // Check if the old password matches
  const isCorrectPassword = await verifyPassword(
    oldPassword,
    isUserExist.password,
  );

  if (!isCorrectPassword) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'your old password is incorrect.Please try again',
    );
  }

  const hashedNewPassword = await convertHashPassword(newPassword);

  // Update the user's password
  await User.findByIdAndUpdate(user?.userId, {
    password: hashedNewPassword,
  });
};

// Change email
const changeEmail = async (
  user: JwtPayload | null,
  payload: IChangeEmail,
): Promise<ILoginUserResponse> => {
  const { email, password } = payload;
  // Fetch the user by email and include the password field
  const existingUser = await User.isUserExist(user?.email);
  if (!existingUser) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User does not exist');
  }

  if (user?.email === email) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'This email address is already in use. Please enter a different email.',
    );
  }

  const isEmailExisted = await User.isUserExist(payload?.email);

  if (isEmailExisted) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This email address is already in use. Please enter a different email.',
    );
  }

  // Verify if the provided password matches the existing user's password
  const isPasswordValid = await verifyPassword(
    password,
    existingUser?.password,
  );

  if (!isPasswordValid) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'Incorrect password. Please try again.',
    );
  }

  // Update the user's email and reset the email verification status
  const updatedUser = await User.findByIdAndUpdate(
    { _id: existingUser?._id },
    { email: email, isEmailVerified: false },
    { new: true },
  );

  if (!updatedUser) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update email. Please try again later.',
    );
  }

  const response = await AuthService.userLogin({
    email: updatedUser?.email,
    password: password,
  });

  // // Send verification email to the new email address
  // await sendVerificationEmail({
  //   name: updatedUser?.name,
  //   email: updatedUser?.email,
  // });

  return response;
};

const sendVerificationEmail = async (payload: {
  email: string;
  name?: string;
}): Promise<void> => {
  const { email, name } = payload;
  const isUserExist = await User.isUserExist(email);

  // checking if user exists
  if (!isUserExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'This user does not exist.');
  }

  const currentYear = new Date().getFullYear();

  const passVerificationToken = jwtHelpers.createResetToken(
    { userId: isUserExist?._id, email: isUserExist?.email },
    config.jwt.tokenSecret as string,
    '5m',
  );

  const verificationBaseUrl = config.verify_user_url;

  const mailInfo = {
    to: email,
    subject: 'Secure Your Account: Verify Your Account',
    html: `
    <!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Verify Your Email Address</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
    <div style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://example.com/logo.png" alt="Logo" style="width: 100px;">
        </div>
        <div style="text-align: left; line-height: 1.6;">
            <h2>Verify Your Email Address</h2>
            <p>Hi ${name || 'there'},</p>
            <p>Thank you for signing up. To complete your registration, please verify your email address by clicking the button below:</p>
            <a href="${verificationBaseUrl}/${passVerificationToken}" style="display: block; width: 200px; margin: 20px auto; padding: 10px; background-color: #007bff; color: #ffffff; text-align: center; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify Email
            </a>
            <p>Thank you,</p>
            <p>The CarEBid Team</p>
        </div>
        <div style="text-align: center; padding-top: 20px; font-size: 12px; color: #777777;">
            <p>&copy; ${currentYear}  CarEBid. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `,
  };

  // console.log(mailInfo);
  await sendMailerHelper.sendMail(mailInfo);
};

const verifyEmail = async (token: string) => {
  const isVerified = jwtHelpers.verifyToken(
    token,
    config.jwt.tokenSecret as string,
  );

  if (!isVerified) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Invalid  or expired Link!. Please try again',
    );
  }

  const { userId, email } = isVerified;
  const isUserExist = await User.isUserExist(email);
  if (!isUserExist) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Sorry something is wrong. Please try again',
    );
  }

  if (isUserExist?.isEmailVerified) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'your email is already verified',
    );
  }
  await User.findByIdAndUpdate({ _id: userId }, { isEmailVerified: true });
};

// ForgetPassword
const forgetPassword = async (
  payload: IForgetPassword,
): Promise<IAuthMessage> => {
  const { email } = payload;

  // Check if the user exists
  const isUserExist = await User.findOne({ email: email });

  if (!isUserExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'This user does not exist.');
  }

  const name = isUserExist.name;
  const otp = await getOTP(email);

  // Email content
  const mailInfo = {
    to: email,
    subject: 'Secure Your Account: Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Verification</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background-color: #f9f9f9;
                  margin: 0;
                  padding: 0;
              }
              .container {
                  max-width: 600px;
                  margin: 40px auto;
                  background-color: #ffffff;
                  border-radius: 8px;
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                  overflow: hidden;
              }
              .header {
                  background-color: #4CAF50;
                  color: white;
                  text-align: center;
                  padding: 20px;
              }
              .header h2 {
                  margin: 0;
              }
              .content {
                  padding: 30px;
                  color: #333;
                  line-height: 1.6;
              }
              .content p {
                  margin: 16px 0;
              }
              .otp-box {
                  display: flex;
                  justify-content: center;
                  background-color: #f7f7f7;
                  border: 1px dashed #4CAF50;
                  padding: 10px 20px;
                  font-size: 18px;
                  font-weight: bold;
                  color: #4CAF50;
                  margin: 20px 0;
              }
              .footer {
                  background-color: #f1f1f1;
                  text-align: center;
                  padding: 15px;
                  font-size: 14px;
                  color: #777;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h2>Password Reset Verification</h2>
              </div>
              <div class="content">
                  <p>Hi ${name},</p>
                  <p>We received a request to reset the password for your account associated with this email.</p>
                  <p>Use the OTP below to verify your identity and reset your password:</p>
                  <div class="otp-box">${otp?.otp}</div>
                  <p>If you did not request this, please disregard this email. Your account is still secure.</p>
              </div>
              <div class="footer">
                  <p>Best regards,<br />The CarEBid Team</p>
              </div>
          </div>
      </body>
      </html>
    `,
  };

  await sendMailerHelper.sendMail(mailInfo);

  // Return a success response
  return { message: 'Password reset email sent successfully.' };
};

// Reset Password
const resetPassword = async (
  payload: IResetPassword,
): Promise<IAuthMessage> => {
  const { newPassword, otp, email } = payload;

  const isUserExist = await User.isUserExist(email);
  if (!isUserExist) {
    throw new ApiError(httpStatus.NOT_FOUND, 'user does not exist');
  }

  await verifyOtp(email, otp);

  const isMatchPreviousPassword = await verifyPassword(
    newPassword,
    isUserExist.password,
  );

  if (isMatchPreviousPassword) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Please choose a different password.',
    );
  }

  // Hash the new password
  const hashedPassword = await convertHashPassword(newPassword);

  // Update the user's password
  await User.findOneAndUpdate({ email }, { password: hashedPassword });

  return { message: 'user password updated successfully' };
};

// Login with Google
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: config.google.client_id as string,
//       clientSecret: config.google.client_secret as string,
//       callbackURL: config.google.callback_url as string,
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         // Check if the user already exists

//         let user = await User.isUserExist(profile.emails?.[0].value as string);

//         if (!user) {
//           // If the user doesn't exist, create a new user
//           user = await User.create({
//             name: profile.displayName,
//             email: profile.emails?.[0].value,
//             role: 'customer',
//             accountType: 'personal', // or default value
//             isEmailVerified: true, // Since Google email is verified by default
//             password: '', // No password for Google login
//           });
//         }

//         done(null, user);
//       } catch (error) {
//         done(error, null);
//       }
//     },
//   ),
// );

// passport.serializeUser((user: any, done) => {
//   done(null, user._id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const user = await User.findById(id);
//     done(null, user);
//   } catch (error) {
//     done(error, null);
//   }
// });

export const AuthService = {
  userLogin,
  impersonateUser,
  createLoginResponseForUser,
  isUserExist,
  changeEmail,
  getNewAccessToken,
  changePassword,
  verifyEmail,
  sendVerificationEmail,
  resetPassword,
  forgetPassword,
};
