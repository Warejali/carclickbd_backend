// models/OtpModel.ts
import { model, Schema } from 'mongoose';
import { IOtp } from './otp.interface';

const otpSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export const OTP = model<IOtp>('Otp', otpSchema);
