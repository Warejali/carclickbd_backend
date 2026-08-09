import { Request, Response } from 'express';
import { Express } from 'express';
import httpStatus from 'http-status';
import { productService } from './product.service'; // Adjust import path as needed
import catchAsync from '../../../shared/catchAsync';
import sendResponse, { IGenericResponse } from '../../../shared/sendResponse';
import {
  IProduct,
  IProductFilterableField,
  ProductStatus,
} from './product.interface';
import { IUploadFile } from '../../../inerfaces/file';
import pick from '../../../shared/pick';
import { paginationFields } from '../../../constant/pagination';
import { productFilterableFields } from './product.constant';
import { JwtPayload } from 'jsonwebtoken';

// Create Product
const createProduct = catchAsync(async (req: Request, res: Response) => {
  const productData = JSON.parse(req.body.data);
  const { userId, sellerType } = req.user as JwtPayload;
  const readyData = { ...productData, seller: userId, sellerType: sellerType };
  const files =
    (req.files as
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined) || [];
  const flattenedFiles = getFlattenedFiles(files);

  const result = await productService.createProduct(readyData, flattenedFiles);

  sendResponse<IProduct>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product created successfully!',
    data: result,
  });
});

const toggleProductStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await productService.toggleProductStatus(id);

  sendResponse<IProduct>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product updated successfully !',
    data: result,
  });
});

const updateProductStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const { userId, role } = req.user as JwtPayload;
  const result = await productService.updateProductStatus(
    id,
    status as ProductStatus,
    userId,
    role,
  );

  sendResponse<IProduct>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product status updated successfully!',
    data: result,
  });
});

const getFlattenedFiles = (
  files?:
    | Express.Multer.File[]
    | { [fieldname: string]: Express.Multer.File[] },
): IUploadFile[] => {
  if (Array.isArray(files)) {
    return files as IUploadFile[];
  }

  return Object.entries(files || {}).reduce((acc, [fieldname, fieldFiles]) => {
    return [...acc, ...fieldFiles.map(file => ({ ...file, fieldname }))];
  }, [] as IUploadFile[]);
};
const toggleProductFeatured = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await productService.toggleProductFeatured(id);

    sendResponse<IProduct>(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Updated successfully !',
      data: result,
    });
  },
);

const getSearchResult = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const paginationOption = pick(query, paginationFields);
  const filters = pick(
    query,
    productFilterableFields,
  ) as unknown as IProductFilterableField;
  const result = await productService.getSearchResult(
    paginationOption,
    filters,
  );
  sendResponse<IGenericResponse<IProduct[]>>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products fetched successfully!',
    meta: result.meta,
    data: result.data as any,
  });
});

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const paginationOption = pick(query, paginationFields);
  const filters = pick(
    query,
    productFilterableFields,
  ) as unknown as IProductFilterableField;
  const user = req.user as JwtPayload | undefined;
  const result = await productService.getAllProducts(
    paginationOption,
    filters,
    user,
  );
  sendResponse<IGenericResponse<IProduct[]>>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products fetched successfully!',
    meta: result.meta,
    data: result.data as any,
  });
});
const getMyProducts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const query = req.query;
  const paginationOption = pick(query, paginationFields);
  const filters = pick(
    query,
    productFilterableFields,
  ) as unknown as IProductFilterableField;

  const result = await productService.getMyProducts(
    paginationOption,
    filters,
    user.userId,
    user,
  );
  sendResponse<IGenericResponse<IProduct[]>>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products fetched successfully!',
    meta: result.meta,
    data: result.data as any,
  });
});

const getProductById = catchAsync(async (req: Request, res: Response) => {
  const productId = req.params.id;

  const user = req.user as JwtPayload;

  // console.log(user);
  const result = await productService.getProductById(productId, user);
  if (!result) {
    return sendResponse<null>(res, {
      statusCode: httpStatus.NOT_FOUND,
      success: false,
      message: 'Product not found',
      data: null,
    });
  }

  sendResponse<IProduct>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product fetched successfully!',
    data: result,
  });
});

// Update product
const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const productId = req.params.id;
  const { userId, role } = req.user as JwtPayload;
  const productData = req.body?.data ? JSON.parse(req.body.data) : req.body;
  const files =
    (req.files as
      | Express.Multer.File[]
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined) || [];
  const flattenedFiles = getFlattenedFiles(files);

  const result = await productService.updateProduct(
    productId,
    userId,
    role,
    productData,
    flattenedFiles,
  );

  sendResponse<IProduct>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product updated successfully!',
    data: result,
  });
});

// Delete product
const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const productId = req.params.id;
  const { userId, role } = req.user as JwtPayload;
  const result = await productService.deleteProduct(productId, userId, role);

  sendResponse<IProduct>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product deleted successfully!',
    data: result,
  });
});

export const productController = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getMyProducts,
  toggleProductStatus,
  updateProductStatus,
  toggleProductFeatured,
  getSearchResult,
};
