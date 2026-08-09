import express from 'express';
import { AuctionSheetController } from './auctionSheet.controller';

const router = express.Router();

router.get('/report', AuctionSheetController.getReport);
router.post('/order', AuctionSheetController.createOrder);
router.get('/payment-status/:id', AuctionSheetController.getPaymentStatus);
router.get('/download/:id', AuctionSheetController.download);

export const auctionSheetRoutes = router;
