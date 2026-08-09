import express from 'express';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/role';
import { UserController } from './user.controller';
import { FileUploadHelper } from '../../../helper/FileUploadHelper';

const router = express.Router();

router.get(
  '/',
  // auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  UserController.getAllUser,
);
router.get('/admin/', UserController.getAllAdmin);
router.get('/seller/', UserController.getAllSeller);
router.get('/customer/', UserController.getAllCustomer);

router.get(
  '/:id',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  UserController.getOneUser,
);

router.post(
  '/',
  // auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  UserController.createUser,
);

router.patch(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  FileUploadHelper.upload.single('file'),
  UserController.updateUser,
);
router.patch(
  '/toggle-status/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  UserController.toggleUserStatus,
);

router.patch(
  '/basic/:id',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  UserController.downgradeMembership,
);

router.patch(
  '/convert-to-seller',
  auth(ENUM_USER_ROLE.CUSTOMER),
  UserController.convertToPersonalSeller,
);

router.delete(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  UserController.deleteUserByadmin,
);
export const UserRoutes = router;
