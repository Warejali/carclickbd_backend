import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { NotificationService } from './notification.service';
import { JwtPayload } from 'jsonwebtoken';

const createNotification = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };
  const result = await NotificationService.createNotification(payload);

  sendResponse<Notification[] | any>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Notification created successfully!',
    data: result,
  });
});

const createProductInquiryNotification = catchAsync(
  async (req: Request, res: Response) => {
    const { product, productId, itemName, name, email, phone, message } =
      req.body;
    const targetProduct = product || productId;
    const buyerLine = [name, phone, email].filter(Boolean).join(' | ');
    const result = await NotificationService.createAdminNotifications({
      product: targetProduct,
      itemName,
      message: `New buyer inquiry${itemName ? ` for ${itemName}` : ''}${
        buyerLine ? ` from ${buyerLine}` : ''
      }${message ? `: ${message}` : ''}`,
    });

    sendResponse<Notification[] | any>(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Inquiry notification sent successfully!',
      data: result,
    });
  },
);

const getAllNotifications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { userId } = user;

  const result = await NotificationService.getAllNotifications(userId);
  sendResponse<Notification[] | any>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notifications fetched successfully!',
    data: result,
  });
});

const updateNotification = catchAsync(async (req: Request, res: Response) => {
  const notificationId = req.params.id;
  console.log('notificationId', notificationId);

  const updatedNotification =
    await NotificationService.updateNotificationStatus(notificationId);

  if (!updatedNotification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Notification status updated successfully',
    data: updatedNotification,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const notificationId = req.params.id;

  const result = await NotificationService.deleteNotification(notificationId);

  sendResponse<Notification[] | any>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Notification deleted successfully!',
    data: result,
  });
});

export const NotificationController = {
  createNotification,
  createProductInquiryNotification,
  getAllNotifications,
  deleteNotification,
  updateNotification,
};
