import express from 'express';
import { OrderController } from './order.controller';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/role';

const router = express.Router();

router.post(
  '/create-order',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  OrderController.createOrder,
);

router.get('/', OrderController.getAllOrders);
router.get(
  '/my-order',
  auth(
    ENUM_USER_ROLE.ADMIN,
    ENUM_USER_ROLE.SUPER_ADMIN,
    ENUM_USER_ROLE.SELLER,
    ENUM_USER_ROLE.CUSTOMER,
  ),
  OrderController.getMyOrders,
);

router.get('/:id', OrderController.getSingleOrder);

router.patch('/:id', OrderController.updateOrder);

router.delete('/:id', OrderController.deleteOrder);

export const OrderRoutes = router;
