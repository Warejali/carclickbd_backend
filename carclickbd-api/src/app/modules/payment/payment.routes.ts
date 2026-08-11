import express from 'express';
import { PaymentController } from './payment.controller';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/role';

const router = express.Router();

router.get(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  PaymentController.getAllFromDB,
);
router.post('/bdgate/webhook', PaymentController.bdGateWebhook);
router.get(
  '/bdgate/auction-sheet/status/:id',
  PaymentController.syncBdGateAuctionSheetPaymentStatus,
);
router.post(
  '/bdgate/auction-sheet',
  PaymentController.initBdGateAuctionSheetPayment,
);
router.get(
  '/bdgate/status/:token',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  PaymentController.syncBdGatePaymentStatus,
);
router.post(
  '/bdgate/init',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  PaymentController.initBdGatePayment,
);
router.get(
  '/:id',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  PaymentController.getByIdFromDB,
);
router.post(
  '/init',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  PaymentController.initPayment,
);
router.post(
  '/create',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  PaymentController.createPayment,
);

export const paymentRoutes = router;
