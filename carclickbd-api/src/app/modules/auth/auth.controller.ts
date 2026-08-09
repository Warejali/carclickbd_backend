import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import { AuthService } from './auth.service';
import config from '../../../config';
import sendResponse from '../../../shared/sendResponse';
import { ILoginUserResponse, IRefreshTokenResponse } from './auth.interface';
import { JwtHeader, JwtPayload } from 'jsonwebtoken';

// userLogin
const userLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.userLogin(req.body);

  // Set refresh token in cookie
  res.cookie('refreshToken', result?.token?.refreshToken, {
    secure: config.env === 'production',
    httpOnly: true,
  });

  // Send response
  sendResponse<ILoginUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully!',
    data: {
      accessToken: result?.token?.accessToken,
      user: result.user,
    },
  });
});

const impersonateUser = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await AuthService.impersonateUser(user, req.params.userId);

  res.cookie('refreshToken', result?.token?.refreshToken, {
    secure: config.env === 'production',
    httpOnly: true,
  });

  sendResponse<ILoginUserResponse>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully!',
    data: {
      accessToken: result?.token?.accessToken,
      user: result.user,
    },
  });
});

// checking is User exist
const isUserExist = catchAsync(async (req: Request, res: Response) => {
  const { ...payload } = req.body;

  const result = await AuthService.isUserExist(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Result Fatched successful',
    data: result,
  });
});

// refreshToken
const getNewAccessToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  const result = await AuthService.getNewAccessToken(refreshToken);

  // set refresh token into cookie
  const cookieOptions = {
    secure: config.env === 'production',
    httpOnly: true,
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  sendResponse<IRefreshTokenResponse>(res, {
    statusCode: 200,
    success: true,
    message: 'User logged in successfully !',
    data: result,
  });
});

// change password
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtHeader;
  const { ...passwordData } = req.body;

  await AuthService.changePassword(user, passwordData);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Password changed successfully !',
    data: null,
  });
});

// change password
const changeEmail = catchAsync(async (req: Request, res: Response) => {
  const user = req?.user as JwtPayload;
  const { ...data } = req.body;

  const result = await AuthService.changeEmail(user, data);

  sendResponse<ILoginUserResponse>(res, {
    statusCode: 200,
    success: true,
    message: 'Email changed successfully !',
    data: result,
  });
});

// ForgetPassword
const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.forgetPassword(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Please.Check your email!',
    data: null,
  });
});

// Reset Password
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  // const token = req.params.token;

  await AuthService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'your account is  recovered!',
    data: null,
  });
});

const sendVerificationEmail = catchAsync(
  async (req: Request, res: Response) => {
    // const user = req?.user as JwtPayload;
    const data = req.body;
    await AuthService.sendVerificationEmail(data);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'Please.Check your email!',
      data: null,
    });
  },
);

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  // const payload = req.body;
  const token = req.params.token;
  // const user = req.user as JwtPayload;

  await AuthService.verifyEmail(token);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Congratulation.your account is Verified !',
    data: null,
  });
});

//  handle login
// const handleGoogleLogin = async (req: Request, res: Response) => {
//   const user = req.user as JwtPayload;

//   const accessTokenPayload = {
//     userId: user._id,
//     role: user.role,
//     email: user.email,
//     accountType:user
//   };

//   if (user.role === 'customer') {
//     accessTokenPayload.accountType = user.accountType;
//   }

//   const accessToken = jwtHelpers.createToken(
//     accessTokenPayload,
//     process.env.JWT_ACCESS_TOKEN_SECRET as string,
//     process.env.JWT_ACCESS_TOKEN_EXPIRES_IN as string,
//   );

//   const refreshToken = jwtHelpers.createToken(
//     accessTokenPayload,
//     process.env.JWT_REFRESH_TOKEN_SECRET as string,
//     process.env.JWT_REFRESH_TOKEN_EXPIRES_IN as string,
//   );

//   res.cookie('refreshToken', refreshToken, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//   });

//   const result: ILoginUserResponse = {
//     token: {
//       accessToken: accessToken,
//       isEmailVerified: user.isEmailVerified,
//     },
//     user: user,
//   };

//   sendResponse<ILoginUserResponse>(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'User logged in successfully!',
//     data: result,
//   });
// };

export const AuthController = {
  userLogin,
  impersonateUser,
  getNewAccessToken,
  sendVerificationEmail,
  verifyEmail,
  changePassword,
  forgetPassword,
  resetPassword,
  changeEmail,
  // handleGoogleLogin,
  isUserExist,
};
