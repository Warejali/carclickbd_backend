import { Types } from 'mongoose';

export type IBid = {
  user: Types.ObjectId;
  product: Types.ObjectId;
  bidAmount: string;
  isWinner?: boolean;
};

export type IBidFilterableField = {
  searchTerm: string;
  isWinner: boolean;
  userId: string;
  highestBid: string;
  productId: string;
  newlyListed: string;
  endingSoon: string;
};
