/* eslint-disable no-unused-vars */
import { Model } from 'mongoose';

export type ICommonProfile = {
  userId: string;
  name: string;
  profilePhoto?: string;
};

export type IUser = {
  _id?: string;
  name?: string;
  businessName?: string;
  email: string;
  password: string;
  role: 'customer' | 'seller' | 'admin' | 'super-admin';
  membership: 'basic' | 'standard' | 'premier' | 'business' | 'dealer';
  sellerType?: 'dealer' | 'personal';
  accountType?: 'dealer' | 'personal';
  documents?: string[];
  isDealer?: boolean;
  isMembership?: boolean;
  isDisabled: boolean;
  address?: string;
  contactNo?: string;
  whatsappNumber?: string;
  showroomOfficeAddress?: string;
  totalProduct?: number;
  profilePhoto?: string;
  passwordChangedAt?: Date;
  isEmailVerified?: boolean;
};

export type IUserFilters = {
  searchTerm?: string;
  role?: string;
  email?: string;
  contactNo?: string;
  whatsappNumber?: string;
  businessName?: string;
  sellerType?: string;
  accountType?: string;
  isMembership?: boolean;
  isDisabled?: boolean;
};

export type UserModel = {
  isUserExist(email: string): Promise<IUser>;
  isPasswordMatched(
    givenPassword: string,
    savedPassword: string,
  ): Promise<boolean>;
} & Model<IUser>;
