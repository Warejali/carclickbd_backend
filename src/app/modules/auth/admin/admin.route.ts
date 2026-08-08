import express from 'express';
import { AdminController } from './admin.controller';
import auth from '../../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../../enums/role';

const router = express.Router();

router.post(
  '/register',
  auth(ENUM_USER_ROLE.SUPER_ADMIN),
  AdminController.adminRegistration,
);

export const AdminRoutes = router;
