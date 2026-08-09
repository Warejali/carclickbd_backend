import { IUser } from '../user/user.interface';

export type ILoginUser = {
  email: string;
  password: string;
};

export type ILoginUserResponse = {
  token?: {
    accessToken: string;
    refreshToken?: string;
    isEmailVerified?: boolean;
  };
  accessToken?: string;
  user: IUser;
};

export type IDataValidationResponse = {
  validationResponse: {
    message?: string;
  };
};

export type IRefreshTokenResponse = {
  accessToken: string;
};

export type IChangePassword = {
  oldPassword: string;
  newPassword: string;
};

export type IChangeEmail = {
  password: string;
  email: string;
};

export type IForgetPassword = {
  email: string;
};

export type IResetPassword = {
  otp: string;
  email: string;
  newPassword: string;
};

export type IAuthMessage = {
  message: string;
};
