import express from 'express';
import { ENUM_USER_ROLE } from '../../../../enums/role';
import auth from '../../../middlewares/auth';
import { WatchlistController } from './watchlist.controller';

const router = express.Router();

// Create a comment for a product
router.post(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  WatchlistController.addToWatchlist,
);

// Reply to a comment
router.get(
  '/',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  WatchlistController.getUserWatchlist,
);

// Delete a specific comment
router.delete(
  '/:id',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  WatchlistController.removeFromWatchlist,
);

export const wahtchlistRoutes = router;
