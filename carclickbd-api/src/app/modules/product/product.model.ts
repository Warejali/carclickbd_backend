import { Schema, model } from 'mongoose';
import { IProduct } from './product.interface';
import { productStatus } from './product.constant';

const hideLastThreeDigits = (value?: string) => {
  if (!value) {
    return value;
  }

  const visiblePart = value.slice(0, Math.max(value.length - 3, 0));
  return `${visiblePart}${'*'.repeat(Math.min(value.length, 3))}`;
};

const ProductSchema = new Schema<IProduct>(
  {
    // Photos
    photos: {
      mainPhoto: {
        type: String,
        required: true,
      },
      others: {
        type: [String],
        required: false,
      },
    },
    // Car Details
    title: {
      type: String,
      required: true,
      trim: true,
    },
    maker: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    grade: {
      type: String,
      required: false,
    },
    year: {
      type: Number,
      required: true,
    },
    registrationYear: {
      type: Number,
      required: false,
    },
    productionYear: {
      type: Number,
      required: true,
    },
    stockNumber: {
      type: String,
      required: false,
      index: true,
      trim: true,
    },
    referenceNumber: {
      type: String,
      required: false,
      index: true,
      trim: true,
    },
    mileage: {
      type: Number,
      required: true,
    },
    engineSize: {
      type: String,
      required: true,
    },
    engineCc: {
      type: String,
      required: false,
      trim: true,
    },
    modelCode: {
      type: String,
      required: false,
      trim: true,
    },
    fuelType: {
      type: String,
      required: true,
    },
    transmission: {
      type: String,
      required: true,
    },
    driveType: {
      type: String,
      required: true,
    },
    steering: {
      type: String,
      required: false,
      trim: true,
    },
    steeringType: {
      type: String,
      required: false,
      trim: true,
    },
    seats: {
      type: Number,
      required: false,
    },
    seatCount: {
      type: Number,
      required: false,
    },
    bodyType: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    vinChassisNumber: {
      type: String,
      required: false,
    },
    auctionGrade: {
      type: String,
      required: false,
    },
    condition: {
      type: String,
      required: true,
    },
    price: {
      type: String,
      required: true,
    },
    location: {
      type: Schema.Types.Mixed,
      required: false,
    },
    featuresAndOptions: {
      type: [String],
      required: false,
    },
    accessories: {
      type: [String],
      required: false,
    },
    optionsList: {
      type: [String],
      required: false,
    },
    optionsText: {
      type: String,
      required: false,
      trim: true,
    },
    options: {
      type: String,
      required: false,
      trim: true,
    },
    additionalOptions: {
      type: String,
      required: false,
      trim: true,
    },
    internalNote: {
      type: String,
      required: false,
      trim: true,
    },
    adminNote: {
      type: String,
      required: false,
      trim: true,
    },
    videoLinks: {
      type: [String],
      required: false,
    },
    // System fields
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerType: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: productStatus,
      default: 'pending',
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: false,
    },
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductComment',
      },
    ],
    totalComment: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    isWinner: {
      type: Boolean,
      default: false,
    },
    isAuction: {
      type: Boolean,
      default: false,
    },
    isSoldOut: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isDraft: {
      type: Boolean,
      default: true,
    },
    startBid: {
      type: Date,
      required: false,
    },
    endBid: {
      type: Date,
      required: false,
    },
    minBid: {
      type: Number,
      default: 0,
    },
    totalBids: {
      type: Number,
      default: 0,
    },
    highestBid: {
      type: Number,
      default: 0,
    },
    highestBidder: {
      id: String,
      name: String,
      profilePhoto: String,
    },
  },

  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.vinChassisNumber = hideLastThreeDigits(ret.vinChassisNumber);
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        ret.vinChassisNumber = hideLastThreeDigits(ret.vinChassisNumber);
        return ret;
      },
    },
  },
);
export const Product = model<IProduct>('Product', ProductSchema);
