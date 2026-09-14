import { EPSService } from './eps.service';
import catchAsync from '../../../shared/catchAsync';
import { JwtPayload } from 'jsonwebtoken';
import express from 'express';
import { PaymentController } from './payment.controller';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/role';

const router = express.Router();

router.get(
  '/eps/return/:reference',
  catchAsync(async (req, res) => {
    res.redirect(303, await EPSService.handleReturn(req.params.reference));
  }),
);

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
// EPS verifies all payment state with the gateway, never with browser-supplied status.
const roles = [
  ENUM_USER_ROLE.ADMIN,
  ENUM_USER_ROLE.SUPER_ADMIN,
  ENUM_USER_ROLE.SELLER,
  ENUM_USER_ROLE.CUSTOMER,
];
router.post(
  '/eps/init',
  auth(...roles),
  catchAsync(async (req, res) => {
    const data = await EPSService.init(
      'order',
      req.body.order || req.body.orderId,
      (req.user as JwtPayload).userId,
    );
    res.json({ success: true, data });
  }),
);
router.post(
  '/eps/auction-sheet',
  catchAsync(async (req, res) => {
    const data = await EPSService.init('auction-sheet', req.body.orderId);
    res.json({ success: true, data });
  }),
);
router.get(
  '/eps/status/:token',
  auth(...roles),
  catchAsync(async (req, res) => {
    const data = await EPSService.sync(
      req.params.token,
      (req.user as JwtPayload).userId,
    );
    res.json({ success: true, data });
  }),
);
router.get(
  '/eps/auction-sheet/status/:id',
  catchAsync(async (req, res) => {
    res.json({
      success: true,
      data: await EPSService.auctionStatus(req.params.id),
    });
  }),
);
// Retired checkout and client-declared payment routes cannot create paid orders.
router.post(
  [
    '/create',
    '/init',
    '/bdgate/init',
    '/bdgate/auction-sheet',
    '/bdgate/webhook',
  ],
  (_req, res) => {
    res.status(410).json({
      success: false,
      message: 'This payment endpoint has been replaced by EPS.',
    });
  },
);
router.get('/:id', auth(...roles), PaymentController.getByIdFromDB);
export const paymentRoutes = router;
