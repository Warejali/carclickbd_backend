import express from 'express';
import validateRequest from '../../middlewares/ValidateRequest';
import { authValidationSchema } from './auth.validation';
import { AuthController } from './auth.controller';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/role';
import { CustomerRoutes } from './customer/customer.route';
import { AdminRoutes } from './admin/admin.route';
import { SellerRoutes } from './seller/seller.route';

const router = express.Router();

router.use('/customer', CustomerRoutes);
router.use('/admin', AdminRoutes);
router.use('/seller', SellerRoutes);

router.post(
  '/login',
  validateRequest(authValidationSchema.userLoginZodSchema),
  AuthController.userLogin,
);

router.post(
  '/impersonate/:userId',
  auth(ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN),
  AuthController.impersonateUser,
);

router.post('/is-exist', AuthController.isUserExist);

router.post(
  '/get-new-accessToken',
  validateRequest(authValidationSchema.refreshTokenZodSchema),
  AuthController.getNewAccessToken,
);

router.patch(
  '/change-password',
  validateRequest(authValidationSchema.changePasswordZodSchema),
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  AuthController.changePassword,
);

router.patch(
  '/change-email',
  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  AuthController.changeEmail,
);

router.post('/forget-password', AuthController.forgetPassword);

router.patch('/reset-password', AuthController.resetPassword);

router.post(
  '/send-verification-email',

  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  AuthController.sendVerificationEmail,
);

router.patch(
  '/verify-email/:token',

  auth(
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  AuthController.verifyEmail,
);

export const AuthRoutes = router;
