import express from 'express';
import auth from '../../../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../../../enums/role';
import { commentHistoriesController } from './commenthistory.controller';

const router = express.Router();

// Create a comment for a product
router.get(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  commentHistoriesController.getCommentHistories,
);

export const commentHistoriesRoutes = router;
