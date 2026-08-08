import express from 'express';
import { ENUM_USER_ROLE } from '../../../../enums/role';
import auth from '../../../middlewares/auth';
import publicAuth from '../../../middlewares/publicAuth';
import { BidController } from './bids.controller';

const router = express.Router();

router.post(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
    ENUM_USER_ROLE.SELLER,
  ),
  BidController.createBid,
);

router.get(
  '/my-bids',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  BidController.getMyBid,
);

router.get(
  '/all',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  BidController.getAllProductBids,
);
router.get(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.SELLER),
  BidController.getSpecificProductBids,
);

router.get('/:id', publicAuth(), BidController.getSellerProductBids);

export const bidsRoutes = router;
