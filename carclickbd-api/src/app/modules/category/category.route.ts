import express from 'express';
import { ENUM_USER_ROLE } from '../../../enums/role';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/ValidateRequest';
import { CategoryController } from './category.controller';
import { CategoryValidation } from './category.validation';

const router = express.Router();

router.post(
  '/create-category',
  // auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.SELLER),
  validateRequest(CategoryValidation.categoryZodValidationSchema),
  CategoryController.createCategory,
);

router.post(
  '/create-subcategory',
  // auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  validateRequest(CategoryValidation.subcategoryZodValidationSchema),
  CategoryController.createSubcategory,
);

router.get('/', CategoryController.getAllCategories);

router.patch(
  '/:id',
  // auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  CategoryController.updateCategory,
);

router.delete(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  CategoryController.deleteCategory,
);

export const CategoryRoute = router;
