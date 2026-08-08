import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { CategoryService } from './category.service';
import { CategoryInput, CategoryType } from './category.interface';
import { Types } from 'mongoose';

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  const result = await CategoryService.createCategory(payload);

  sendResponse<CategoryType>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Category created successfully!',
    data: result,
  });
});

const createSubcategory = catchAsync(async (req: Request, res: Response) => {
  const { title, parentCategory } = req.body;

  if (!parentCategory) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: 'Parent category ID is required to create a subcategory!',
    });
  }

  // Convert parentCategory to ObjectId if it's a string
  const categoryData: CategoryInput = {
    title,
    parentCategory: new Types.ObjectId(parentCategory),
  };

  const result = await CategoryService.createCategory(categoryData);

  sendResponse<CategoryType>(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Subcategory created successfully!',
    data: result,
  });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.getAllCategories();

  sendResponse<CategoryType[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Categories fetched successfully!',
    data: result,
  });
});

const getSubcategories = catchAsync(async (req: Request, res: Response) => {
  const parentCategoryId = req.params.parentId;

  const result = await CategoryService.getSubcategories(parentCategoryId);

  sendResponse<CategoryType[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subcategories fetched successfully!',
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const categoryId = req.params.id;
  const categoryData = req.body;

  const result = await CategoryService.updateCategory(categoryId, categoryData);

  sendResponse<CategoryType>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category updated successfully!',
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const categoryId = req.params.id;

  const result = await CategoryService.deleteCategory(categoryId);

  sendResponse<CategoryType>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category deleted successfully!',
    data: result,
  });
});

export const CategoryController = {
  createCategory,
  createSubcategory,
  getAllCategories,
  getSubcategories,
  updateCategory,
  deleteCategory,
};
