import { Types } from 'mongoose';

export type INotification = {
  user: Types.ObjectId;
  product?: Types.ObjectId;
  message: string;
  status?: string;
  isRead: boolean;
  itemName: string;
  overBid: number;
  createdAt?: Date;
};

export type INotificationFilterableField = {
  searchTerm: string;
  user: string;
  message: string;
  isRead: boolean;
  product: string;
  itemName: string;
  overBid: string;
  createdAt: string;
};
