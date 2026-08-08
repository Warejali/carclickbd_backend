import express from 'express';
import { CustomerController } from './customer.controller';
const router = express.Router();

router.post(
  '/register',
  // validateRequest(authValidationSchema.customerRegisterZodSchema),
  CustomerController.customerRegistration,
);

export const CustomerRoutes = router;
