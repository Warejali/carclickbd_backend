import express from 'express';
import { productCommentController } from './comment.controller';
import { ENUM_USER_ROLE } from '../../../../enums/role';
import auth from '../../../middlewares/auth';
import { commentHistoriesRoutes } from './commenthistory/commenthistory.routes';

const router = express.Router();

router.use('/commenthistoris', commentHistoriesRoutes);

// Create a comment for a product
router.post(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  productCommentController.createComment,
);

// Reply to a comment
router.post(
  '/reply/:id',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  productCommentController.postCommentReply,
);

// like or dislike a comment
router.post(
  '/like/:id',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  productCommentController.likeAndDislikeComment,
);

router.get(
  '/all',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.SELLER),
  productCommentController.getAllProductComments,
);
// Get all comments for a specific product
router.get(
  '/',
  auth(ENUM_USER_ROLE.SELLER),
  productCommentController.getMyProductComments,
);
router.get(
  '/:id',
  auth(ENUM_USER_ROLE.SELLER, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  productCommentController.getSpecificProductComments,
);

// Delete a specific comment
router.delete(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  productCommentController.deleteComment,
);

export const productCommentRoute = router;
