import express from 'express';
import { ENUM_USER_ROLE } from '../../../enums/role';
import auth from '../../middlewares/auth';
import { NotificationController } from './notification.controller';

const router = express.Router();

router.post('/create-notification', NotificationController.createNotification);
router.post(
  '/product-inquiry',
  NotificationController.createProductInquiryNotification,
);

router.get(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  NotificationController.getAllNotifications,
);
router.patch(
  '/:id',

  NotificationController.updateNotification,
);

router.delete(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  NotificationController.deleteNotification,
);

export const NotificationRoute = router;
