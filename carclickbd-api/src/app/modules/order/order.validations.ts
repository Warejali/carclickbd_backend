import { z } from 'zod';
const createBidZodSchema = z.object({
  body: z.object({
    price: z.string({
      required_error: 'price is required',
    }),
    userId: z.string({
      required_error: 'Price is required',
    }),
  }),
});

export const BidValidation = {
  createBidZodSchema,
};
