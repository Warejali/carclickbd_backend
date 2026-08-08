import { z } from 'zod';

const categoryZodValidationSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required',
    }),
  }),
});

// Add a new schema for creating subcategories
const subcategoryZodValidationSchema = z.object({
  body: z.object({
    title: z.string({
      required_error: 'Title is required',
    }),
    parentCategory: z.string({
      required_error: 'Parent category ID is required to create a subcategory',
    }),
  }),
});

export const CategoryValidation = {
  categoryZodValidationSchema,
  subcategoryZodValidationSchema, // New validation for subcategory
};
