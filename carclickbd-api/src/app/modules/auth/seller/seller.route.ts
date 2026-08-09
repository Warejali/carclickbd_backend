import express from 'express';
import { SellerController } from './seller.controller';

const router = express.Router();

router.post('/register', SellerController.sellerRegistration);

export const SellerRoutes = router;
