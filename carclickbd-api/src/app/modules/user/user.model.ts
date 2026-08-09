import { Schema, model } from 'mongoose';
import { IUser, UserModel } from './user.interface';
import { accountType, userRole } from './user.constant';
import bcrypt from 'bcrypt';
import { convertHashPassword } from '../../../helper/passwordSecurityHelper';

const UserSchema = new Schema<IUser, UserModel>(
  {
    name: {
      type: String,
      required: false,
      trim: true,
    },
    businessName: {
      type: String,
      required: false,
      trim: true,
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    contactNo: {
      type: String,
    },
    whatsappNumber: {
      type: String,
      required: false,
      trim: true,
    },
    role: {
      type: String,
      enum: userRole,
      default: 'customer',
    },
    membership: {
      type: String,
      enum: accountType,
      default: 'basic',
    },
    sellerType: {
      type: String,
      enum: ['dealer', 'personal'],
      required: false,
    },
    accountType: {
      type: String,
      enum: ['dealer', 'personal'],
      required: false,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      type: String,
    },
    showroomOfficeAddress: {
      type: String,
      required: false,
      trim: true,
    },

    isDisabled: {
      type: Boolean,
      default: false,
    },
    totalProduct: {
      type: Number,
      default: 0,
    },
    passwordChangedAt: {
      type: Date,
    },
    isEmailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

// Pre-save middleware to hash the password
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await convertHashPassword(this.password);
  }
  next();
});

// Static method to check if a user exists by email
UserSchema.statics.isUserExist = async function (
  email: string,
): Promise<IUser | null> {
  return await this.findOne(
    { email: email },
    {
      _id: 1,
      password: 1,
      role: 1,
      accountType: 1,
      sellerType: 1,
      name: 1,
      businessName: 1,
      contactNo: 1,
      whatsappNumber: 1,
      address: 1,
      showroomOfficeAddress: 1,
      email: 1,
      isEmailVerified: 1,
    },
  );
};

// Static method to compare passwords
UserSchema.statics.isPasswordMatched = async function (
  givenPassword: string,
  savedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(givenPassword, savedPassword);
};

export const User = model<IUser, UserModel>('User', UserSchema);
