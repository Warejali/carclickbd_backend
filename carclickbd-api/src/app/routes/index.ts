import express from 'express';
import { AuthRoutes } from '../modules/auth/auth.route';
import { UserRoutes } from '../modules/user/user.route';
import { productRoute } from '../modules/product/product.route';
import { CategoryRoute } from '../modules/category/category.route';
import { bidsRoutes } from '../modules/product/bids/bids.route';
import { NotificationRoute } from '../modules/notification/notification.route';
import { paymentRoutes } from '../modules/payment/payment.routes';
import { OrderRoutes } from '../modules/order/order.routes';
import { chatPOST } from '../modules/chat/route';
import { ContactRoute } from '../modules/contact/contact.route';
import { auctionSheetRoutes } from '../modules/auctionSheet/auctionSheet.routes';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/product',
    route: productRoute,
  },
  {
    path: '/bid',
    route: bidsRoutes,
  },

  {
    path: '/user',
    route: UserRoutes,
  },
  {
    path: '/category',
    route: CategoryRoute,
  },
  {
    path: '/notification',
    route: NotificationRoute,
  },
  {
    path: '/payment',
    route: paymentRoutes,
  },
  {
    path: '/orders',
    route: OrderRoutes,
  },
  {
    path: '/contact',
    route: ContactRoute,
  },
  {
    path: '/auction-sheet',
    route: auctionSheetRoutes,
  },
  // chat module
  {
    path: '/chat',
    route: chatPOST,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));
export default router;
