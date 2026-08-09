import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { INotification } from './notification.interface';
import { Notification } from './notification.model';
import { User } from '../user/user.model';

const createNotification = async (
  payload: INotification,
): Promise<INotification | null> => {
  const result = await Notification.create(payload);
  return result;
};

const createAdminNotifications = async (payload: {
  product?: string;
  message: string;
  itemName?: string;
}): Promise<INotification[] | any[]> => {
  const admins = await User.find({
    role: { $in: ['admin', 'super-admin'] },
  }).select('_id');

  if (!admins.length) {
    return [];
  }

  const notifications = admins.map(admin => ({
    user: admin._id,
    ...(payload.product ? { product: payload.product } : {}),
    message: payload.message,
    itemName: payload.itemName,
    isRead: false,
  }));

  return Notification.insertMany(
    notifications as unknown as Partial<INotification>[],
  );
};

const getAllNotifications = async (
  userId: string,
): Promise<INotification[]> => {
  const result = await Notification.find({ user: userId }).sort({
    createdAt: -1,
  });
  return result;
};
const updateNotificationStatus = async (
  notificationId: string,
): Promise<INotification | null> => {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  notification.isRead = !notification.isRead;
  await notification.save();
  return notification;
};

const deleteNotification = async (
  id: string,
): Promise<INotification | null> => {
  const result = await Notification.findByIdAndDelete(id);
  return result;
};

export const NotificationService = {
  createNotification,
  createAdminNotifications,
  getAllNotifications,
  deleteNotification,
  updateNotificationStatus,
};
