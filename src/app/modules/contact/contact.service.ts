import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { NotificationService } from '../notification/notification.service';

type ContactMessagePayload = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
};

const createContactMessage = async (payload: ContactMessagePayload) => {
  const name = payload?.name?.trim();
  const email = payload?.email?.trim();
  const phone = payload?.phone?.trim();
  const message = payload?.message?.trim();

  if (!name || !email || !phone || !message) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Name, email, WhatsApp number, and message are required',
    );
  }

  return NotificationService.createAdminNotifications({
    itemName: 'Contact Form',
    message: `Contact message from ${name} | ${phone} | ${email}: ${message}`,
  });
};

export const ContactService = {
  createContactMessage,
};
