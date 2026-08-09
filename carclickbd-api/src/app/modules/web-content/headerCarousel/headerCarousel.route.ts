import express from 'express';
import { HeaderCarouselSlideController } from './headerCarousel.controller';
import validateRequest from '../../../middlewares/ValidateRequest';
import { HeaderCarouselValidation } from './headerCarousel.validation';
import auth from '../../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../../enums/role';

const router = express.Router();

router.post(
  '/',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  validateRequest(HeaderCarouselValidation.headerCarouselZodValidationSchema),
  HeaderCarouselSlideController.createSlide,
);

router.get('/', HeaderCarouselSlideController.getAllSlide);

router.patch(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  HeaderCarouselSlideController.updateSlide,
);

router.delete(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  HeaderCarouselSlideController.deleteSlide,
);

export const headerCarouselSliderRoute = router;
