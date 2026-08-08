import { CategoryInput, CategoryType } from './category.interface';
import { Category } from './category.model';

const createCategory = async (
  payload: CategoryInput,
): Promise<CategoryType> => {
  const normalizedTitle = payload.title.toLowerCase();
  const existingCategory = await Category.findOne({
    title: normalizedTitle,
    parentCategory: payload.parentCategory || null, // Check in the same parent category
  });

  if (payload.parentCategory) {
    const parentCategory = await Category.findById(payload.parentCategory);
    if (
      parentCategory &&
      parentCategory.title.toLowerCase() === normalizedTitle
    ) {
      throw new Error(
        'A subcategory cannot have the same name as its parent category.',
      );
    }
  }

  if (existingCategory) {
    throw new Error('Category or subcategory with this title already exists.');
  }

  const result = await Category.create({
    ...payload,
    title: normalizedTitle,
  });

  return result;
};

const getAllCategories = async (): Promise<CategoryType[]> => {
  const result = await Category.find({}).populate('parentCategory');
  return result;
};

const getSubcategories = async (
  parentCategoryId: string,
): Promise<CategoryType[]> => {
  const result = await Category.find({
    parentCategory: parentCategoryId,
  }).populate('parentCategory'); // Populate parent category of subcategory
  return result;
};

const updateCategory = async (
  id: string,
  payload: Partial<CategoryType>,
): Promise<CategoryType | null> => {
  const result = await Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).populate('parentCategory');
  return result;
};

const deleteCategory = async (id: string): Promise<CategoryType | null> => {
  const result = await Category.findByIdAndDelete(id);
  return result;
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getSubcategories,
  updateCategory,
  deleteCategory,
};
