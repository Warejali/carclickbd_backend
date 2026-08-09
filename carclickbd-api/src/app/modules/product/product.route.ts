import express from 'express';
import { FileUploadHelper } from '../../../helper/FileUploadHelper';
import { productController } from './product.controller';
import auth from '../../middlewares/auth';
import { ENUM_USER_ROLE } from '../../../enums/role';
import { productCommentRoute } from './comment/comment.route';
import { wahtchlistRoutes } from './watchlist/watchlist.route';
import { NextFunction, Request, Response } from 'express';
import { jwtHelpers } from '../../../helper/jwtHelpers';
import config from '../../../config';

const router = express.Router();

const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.split(' ')[1]
    : authorization;

  if (!token || token === 'undefined' || token === 'null') {
    return next();
  }

  try {
    req.user = jwtHelpers.verifyToken(
      token,
      config.jwt.accessTokenSecret as string,
    );
  } catch {
    // Keep public product endpoints accessible when no valid token is present.
  }

  return next();
};

// comment api
router.use('/comment', productCommentRoute);
router.use('/watchlist', wahtchlistRoutes);

// Create Product
router.post(
  '/',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.SELLER),
  FileUploadHelper.upload.any(),
  productController.createProduct,
);

router.patch(
  '/toggle-status/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  productController.toggleProductStatus,
);

router.patch(
  '/status/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.SELLER),
  productController.updateProductStatus,
);

router.patch(
  '/toggle-featured/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  productController.toggleProductFeatured,
);

// Get all products
router.get('/', optionalAuth, productController.getAllProducts);

router.get('/search-result', productController.getSearchResult);

router.get(
  '/my-product',
  auth(ENUM_USER_ROLE.SELLER, ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  productController.getMyProducts,
);

// Get product by ID
router.get('/:id', optionalAuth, productController.getProductById);

// Update product
router.patch(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.SELLER),
  FileUploadHelper.upload.any(),
  productController.updateProduct,
);

// Delete product
router.delete(
  '/:id',
  auth(ENUM_USER_ROLE.ADMIN, ENUM_USER_ROLE.SUPER_ADMIN),
  productController.deleteProduct,
);

export const productRoute = router;
