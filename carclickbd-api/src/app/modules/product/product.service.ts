import { FlattenMaps, SortOrder } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { FileUploadHelper } from '../../../helper/FileUploadHelper';
import { paginationHelpers } from '../../../helper/paginationHelper';
import { IUploadFile } from '../../../inerfaces/file';
import { IPaginationOptions } from '../../../inerfaces/pagination';
import { IGenericResponse } from '../../../shared/sendResponse';
import { productSearchableFields, productStatus } from './product.constant';
import {
  IProduct,
  IProductFilterableField,
  ProductStatus,
} from './product.interface';
import { Product } from './product.model';
import httpStatus from 'http-status';
import { BidService } from './bids/bids.service';
import { JwtPayload } from 'jsonwebtoken';
import { ProductCommentService } from './comment/comment.service';
import Watchlist from './watchlist/watchlist.model';
import { IProductComment } from './comment/comment.interface';
import mongoose from 'mongoose';
import { User } from '../user/user.model';
import { ENUM_USER_ROLE } from '../../../enums/role';
import { NotificationService } from '../notification/notification.service';
import { facebookService } from '../social/facebook.service';

const hideLastThreeDigits = (value?: string) => {
  if (!value) {
    return value;
  }

  const visiblePart = value.slice(0, Math.max(value.length - 3, 0));
  return `${visiblePart}${'*'.repeat(Math.min(value.length, 3))}`;
};

const buildProductSearchConditions = (searchTerm: string) =>
  productSearchableFields
    .filter(field => {
      const schemaType = Product.schema.paths[field]?.instance;
      return schemaType === 'String' || schemaType === 'Array';
    })
    .map(field => ({
      [field]: {
        $regex: searchTerm,
        $options: 'i',
      },
    }));

const syncProductStatusFields = (status?: ProductStatus) => {
  if (!status) {
    return {};
  }

  return {
    isDraft: status === 'pending',
    isSoldOut: status === 'sold' || status === 'reserve',
  };
};

const normalizeProductStatusValue = (
  status: unknown,
): ProductStatus | undefined => {
  if (typeof status !== 'string') {
    return undefined;
  }

  const normalized = status.trim().toLowerCase().replace(/\s+/g, '_');
  if (productStatus.includes(normalized as ProductStatus)) {
    return normalized as ProductStatus;
  }

  return undefined;
};

const isProductStatus = (status: unknown): status is ProductStatus =>
  Boolean(normalizeProductStatusValue(status));

const attachWishlistFlags = async <T extends { _id: unknown }>(
  products: T[],
  user?: JwtPayload,
): Promise<Array<T & { isWishlisted: boolean; isWatchlisted: boolean }>> => {
  if (!user?.userId || products.length === 0) {
    return products.map(product => ({
      ...product,
      isWishlisted: false,
      isWatchlisted: false,
    }));
  }

  const productIds = products.map(product => product._id);
  const watchlistedProducts = await Watchlist.find({
    user: user.userId,
    product: { $in: productIds },
  }).select('product');
  const watchlistedProductIds = new Set(
    watchlistedProducts.map(item => item.product.toString()),
  );

  return products.map(product => {
    const isWishlisted = watchlistedProductIds.has(String(product._id));
    return {
      ...product,
      isWishlisted,
      isWatchlisted: isWishlisted,
    };
  });
};

const createStockNumber = (payload: Partial<IProduct>) => {
  const maker = String(payload.maker || 'CAR')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase();
  const model = String(payload.model || 'BD')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase();
  const suffix = Date.now().toString().slice(-6);

  return `CCBD-${maker}${model}-${suffix}`;
};

const otherPhotoFieldNames = [
  'others',
  'interior',
  'interiorPhoto',
  'interiorPhotos',
  'exterior',
  'exteriorPhoto',
  'exteriorPhotos',
  'mechanical',
  'docs',
];

const getOtherPhotoFiles = (files: IUploadFile[]) =>
  files.filter(file => otherPhotoFieldNames.includes(file.fieldname));

const normalizeProductPayload = (payload: Partial<IProduct>) => {
  const data = { ...payload } as Partial<IProduct> & {
    engine?: string;
    drivetrain?: string;
    bodyStyle?: string;
    mainPrice?: string;
    make?: string;
    vin?: string;
    engineCc?: string;
    engineCC?: string;
    steeringType?: string;
    seatCount?: number;
    accessories?: string[];
    optionsList?: string[];
    optionsText?: string;
    options?: string;
    additionalOptions?: string;
    internalNote?: string;
    adminNote?: string;
    existingMainPhoto?: string;
    existingOtherPhotos?: string[];
  };
  const status = normalizeProductStatusValue(data.status);
  const productionYear = data.productionYear || data.year;
  const stockNumber = data.stockNumber || data.referenceNumber;
  const title =
    data.title ||
    [productionYear, data.maker || data.make, data.model, data.grade]
      .filter(Boolean)
      .join(' ');
  const engineCc =
    data.engineCc || data.engineCC || data.engineSize || data.engine;

  const normalizedPayload = {
    ...data,
    title,
    maker: data.maker || data.make,
    engineSize: data.engineSize || engineCc,
    engineCc,
    driveType: data.driveType || data.drivetrain,
    steering: data.steering || data.steeringType,
    steeringType: data.steeringType || data.steering,
    seats: data.seats || data.seatCount,
    seatCount: data.seatCount || data.seats,
    bodyType: data.bodyType || data.bodyStyle,
    price: data.price || data.mainPrice,
    vinChassisNumber: data.vinChassisNumber || data.vin,
    accessories: data.accessories || data.optionsList,
    optionsList: data.optionsList || data.accessories,
    optionsText: data.optionsText || data.options || data.additionalOptions,
    options: data.options || data.optionsText || data.additionalOptions,
    additionalOptions:
      data.additionalOptions || data.optionsText || data.options,
    internalNote: data.internalNote || data.adminNote,
    adminNote: data.adminNote || data.internalNote,
  };

  if (productionYear) {
    normalizedPayload.year = productionYear;
    normalizedPayload.productionYear = productionYear;
  }

  if (stockNumber) {
    normalizedPayload.stockNumber = stockNumber;
    normalizedPayload.referenceNumber = data.referenceNumber || stockNumber;
  }

  if (status) {
    normalizedPayload.status = status;
  }

  return normalizedPayload;
};

const markExpiredAuctionsAsDraft = async () => {
  await Product.updateMany(
    { endBid: { $exists: true, $lte: new Date() }, isDraft: false },
    { $set: { isDraft: true, isWinner: true } },
  ).catch(err => console.error('Error updating expired products:', err));
};

const createProduct = async (
  productData: IProduct,
  files: IUploadFile[],
): Promise<IProduct | null> => {
  const uploadedUrls: string[] = [];
  const uploadResults: { [key: string]: string[] } = {};
  const session = await mongoose.startSession(); // Start a session

  try {
    session.startTransaction(); // Begin transaction

    const fileGroups = {
      mainPhoto: files.find(file => file.fieldname === 'mainPhoto'),
      others: getOtherPhotoFiles(files),
    };

    if (!fileGroups.mainPhoto) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Main photo is required');
    }

    const uploadPromises = Object.entries(fileGroups).map(([key, files]) => {
      if (key === 'mainPhoto' && files) {
        return FileUploadHelper.uploadSingleImage(files as IUploadFile).then(
          url => {
            uploadResults[key] = [url as string];
            uploadedUrls.push(url as string);
          },
        );
      } else if (Array.isArray(files) && files.length > 0) {
        return FileUploadHelper.uploadMultipleImages(files).then(urls => {
          uploadResults[key] = urls;
          uploadedUrls.push(...urls);
        });
      }
    });

    await Promise.all(uploadPromises);

    const normalizedProductData = normalizeProductPayload(productData);
    const stockNumber =
      normalizedProductData.stockNumber ||
      createStockNumber(normalizedProductData);

    const productWithPhotos = {
      ...normalizedProductData,
      stockNumber,
      referenceNumber: normalizedProductData.referenceNumber || stockNumber,
      status: normalizedProductData.status || 'pending',
      ...syncProductStatusFields(normalizedProductData.status || 'pending'),
      photos: {
        mainPhoto: uploadResults.mainPhoto?.[0],
        others: uploadResults.others || [],
      },
    } as IProduct;

    // Create product within the session
    const result = await Product.create([productWithPhotos], { session });

    // Update user's totalProduct count within the session
    await User.findByIdAndUpdate(
      productData.seller, // Assuming sellerId is the user's ID
      { $inc: { totalProduct: 1 } },
      { session },
    );

    await session.commitTransaction(); // Commit transaction if everything succeeds
    session.endSession();

    await NotificationService.createAdminNotifications({
      product: result[0]._id.toString(),
      itemName: result[0].title,
      message: `New listing added: ${result[0].title}. Review seller listing and status.`,
    });

    // Wait for the publishing attempt so Hostinger cannot finish the request
    // before the Facebook call has been sent. The Facebook service handles API
    // failures internally, so a created listing still remains successful.
    await facebookService.publishProductToFacebook(result[0]);

    return result[0];
  } catch (error) {
    await session.abortTransaction(); // Abort transaction on error
    session.endSession();

    if (uploadedUrls.length > 0) {
      try {
        await FileUploadHelper.deleteMultipleImagesByUrl(uploadedUrls);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded files:', cleanupError);
      }
    }

    throw error;
  }
};

const uploadProductPhotos = async (files: IUploadFile[]) => {
  const uploadedUrls: string[] = [];
  const uploadResults: { mainPhoto?: string; others?: string[] } = {};

  const mainPhoto = files.find(file => file.fieldname === 'mainPhoto');
  const others = getOtherPhotoFiles(files);

  if (mainPhoto) {
    const url = await FileUploadHelper.uploadSingleImage(mainPhoto);
    if (url) {
      uploadResults.mainPhoto = url;
      uploadedUrls.push(url);
    }
  }

  if (others.length > 0) {
    const urls = await FileUploadHelper.uploadMultipleImages(others);
    uploadResults.others = urls;
    uploadedUrls.push(...urls);
  }

  return { uploadResults, uploadedUrls };
};

const toggleProductStatus = async (
  productId: string,
): Promise<IProduct | null> => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  product.status = product.status === 'approval' ? 'pending' : 'approval';
  product.isDraft = product.status === 'pending';
  product.isSoldOut = false;
  await product.save();

  return product;
};

const updateProductStatus = async (
  productId: string,
  status: ProductStatus,
  userId: string,
  role: string,
): Promise<IProduct | null> => {
  const normalizedStatus = normalizeProductStatusValue(status);

  if (!normalizedStatus) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid product status');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const isAdmin =
    role === ENUM_USER_ROLE.ADMIN || role === ENUM_USER_ROLE.SUPER_ADMIN;

  if (!isAdmin && product.seller.toString() !== userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'You are not authorized to update this product status',
    );
  }

  product.status = normalizedStatus;
  Object.assign(product, syncProductStatusFields(normalizedStatus));
  await product.save();

  const updatedProduct = await Product.findById(productId).populate({
    path: 'seller',
    select: 'name email businessName company sellerType',
  });

  return updatedProduct;
};
const toggleProductFeatured = async (
  productId: string,
): Promise<IProduct | null> => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  product.isFeatured = !product.isFeatured;
  await product.save();

  return product;
};

const getMyProducts = async (
  paginationOption: IPaginationOptions,
  filters: IProductFilterableField,
  sellerId: string,
  user?: JwtPayload,
): Promise<IGenericResponse<IProduct[]>> => {
  const { limit, page, skip } =
    paginationHelpers.calculatePagination(paginationOption);

  const { searchTerm, year, registrationYear, ...filterData } = filters;

  const andConditions = [];

  // Search Term
  if (searchTerm) {
    const textSearchConditions = buildProductSearchConditions(searchTerm);

    if (textSearchConditions.length > 0) {
      andConditions.push({ $or: textSearchConditions });
    }
  }

  if (year) {
    const yearRange = year.split('to').map(year => parseInt(year, 10));

    if (
      yearRange.length === 2 &&
      !isNaN(yearRange[0]) &&
      !isNaN(yearRange[1])
    ) {
      const [startYear, endYear] = yearRange;
      andConditions.push({
        year: {
          $gte: startYear,
          $lte: endYear,
        },
      });
    }
  }

  if (registrationYear) {
    const yearRange = registrationYear
      .split('to')
      .map(year => parseInt(year, 10));

    if (
      yearRange.length === 2 &&
      !isNaN(yearRange[0]) &&
      !isNaN(yearRange[1])
    ) {
      const [startYear, endYear] = yearRange;
      andConditions.push({
        registrationYear: {
          $gte: startYear,
          $lte: endYear,
        },
      });
    }
  }

  // Additional Filters
  if (Object.keys(filterData).length) {
    Object.entries(filterData).forEach(([field, value]) => {
      andConditions.push({ [field]: value });
    });
  }

  // Ensure products belong to the given seller
  if (sellerId) {
    andConditions.push({ seller: sellerId });
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  // Automatically update isDraft to true where endBid is expired
  await markExpiredAuctionsAsDraft();

  // Sorting (default: newest expired products first)
  const sortConditions: { [key: string]: SortOrder } = {
    endBid: -1,
  };

  // Fetch updated expired products
  const products = await Product.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'seller',
      select: '_id profilePhoto name',
    })
    .lean();

  const total = await Product.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: (await attachWishlistFlags(products, user)) as unknown as IProduct[],
  };
};

const getSearchResult = async (
  paginationOption: IPaginationOptions,
  filters: IProductFilterableField,
): Promise<IGenericResponse<IProduct[]>> => {
  const { limit, page, skip } =
    paginationHelpers.calculatePagination(paginationOption);

  const { searchTerm } = filters;
  const andConditions = [];

  if (searchTerm) {
    const textSearchConditions = buildProductSearchConditions(searchTerm);

    if (textSearchConditions.length > 0) {
      andConditions.push({ $or: textSearchConditions });
    }
  }

  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  await markExpiredAuctionsAsDraft();

  const sortConditions: { [key: string]: SortOrder } = {
    endBid: 1,
  };

  const products = await Product.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'seller',
      select: '_id profilePhoto name',
    });

  const total = await Product.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: products,
  };
};
const getAllProducts = async (
  paginationOption: IPaginationOptions,
  filters: IProductFilterableField,
  user?: JwtPayload,
): Promise<IGenericResponse<IProduct[]>> => {
  const { limit, page, skip } =
    paginationHelpers.calculatePagination(paginationOption);

  const { searchTerm, year, registrationYear, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
    const textSearchConditions = buildProductSearchConditions(searchTerm);

    if (textSearchConditions.length > 0) {
      andConditions.push({ $or: textSearchConditions });
    }
  }

  if (year) {
    const yearRange = year.split('to').map(year => parseInt(year, 10));

    if (
      yearRange.length === 2 &&
      !isNaN(yearRange[0]) &&
      !isNaN(yearRange[1])
    ) {
      const [startYear, endYear] = yearRange;
      andConditions.push({
        year: {
          $gte: startYear,
          $lte: endYear,
        },
      });
    }
  }

  if (registrationYear) {
    const yearRange = registrationYear
      .split('to')
      .map(year => parseInt(year, 10));

    if (
      yearRange.length === 2 &&
      !isNaN(yearRange[0]) &&
      !isNaN(yearRange[1])
    ) {
      const [startYear, endYear] = yearRange;
      andConditions.push({
        registrationYear: {
          $gte: startYear,
          $lte: endYear,
        },
      });
    }
  }

  if (Object.keys(filterData).length) {
    Object.entries(filterData).forEach(([field, value]) => {
      andConditions.push({ [field]: value });
    });
  }
  const whereConditions =
    andConditions.length > 0 ? { $and: andConditions } : {};

  await markExpiredAuctionsAsDraft();

  const sortConditions: { [key: string]: SortOrder } = {
    endBid: 1,
  };
  const products = await Product.find(whereConditions)
    .sort(sortConditions)
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'seller',
      select: '_id profilePhoto name',
    })
    .lean();

  const total = await Product.countDocuments(whereConditions);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: (await attachWishlistFlags(products, user)) as unknown as IProduct[],
  };
};

const getProductById = async (
  id: string,
  user?: JwtPayload,
): Promise<IProduct | null> => {
  const result = await Product.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true, runValidators: true },
  )
    .populate({
      path: 'seller',
      select: '_id profilePhoto name',
    })
    .lean();

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }
  // console.log('user from service',user)
  const bids = await BidService.getSpecificProductBids(id);

  const isBedded = bids?.some(bid => bid?.user?.toString() === user?.userId);
  const highestBid =
    bids?.sort((a, b) => Number(b.bidAmount) - Number(a.bidAmount))[0]
      ?.bidAmount || 0;

  const comments = (await ProductCommentService.getMyProductComments(
    id,
    user,
  )) as unknown as FlattenMaps<IProductComment>[];

  const [resultWithWishlist] = await attachWishlistFlags([result], user);

  resultWithWishlist.highestBid = Number(highestBid);
  resultWithWishlist.isBedded = isBedded;

  if (resultWithWishlist && comments) {
    resultWithWishlist.comments = comments;
  }

  resultWithWishlist.vinChassisNumber = hideLastThreeDigits(
    resultWithWishlist.vinChassisNumber,
  );

  return resultWithWishlist as unknown as IProduct;
};

// Update a product
const updateProduct = async (
  productId: string,
  userId: string,
  role: string,
  payload: Partial<IProduct>,
  files: IUploadFile[] = [],
): Promise<IProduct | null> => {
  // Check if the product exists
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const isAdmin =
    role === ENUM_USER_ROLE.ADMIN || role === ENUM_USER_ROLE.SUPER_ADMIN;

  if (!isAdmin && product.seller.toString() !== userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'You are not authorized to update this product',
    );
  }

  const sanitizedPayload = normalizeProductPayload(payload);
  const hasImageFiles = files.length > 0;
  let uploadedUrls: string[] = [];
  const existingMainPhoto = sanitizedPayload.existingMainPhoto;
  const existingOtherPhotos = Array.isArray(
    sanitizedPayload.existingOtherPhotos,
  )
    ? sanitizedPayload.existingOtherPhotos.filter(Boolean)
    : undefined;

  delete sanitizedPayload.existingMainPhoto;
  delete sanitizedPayload.existingOtherPhotos;

  if (!isAdmin) {
    delete sanitizedPayload.status;
    delete sanitizedPayload.isDraft;
    delete sanitizedPayload.isSoldOut;
    delete sanitizedPayload.isFeatured;
    delete sanitizedPayload.isWinner;
    delete sanitizedPayload.seller;
    delete sanitizedPayload.sellerType;
  }

  if (sanitizedPayload.status && !isProductStatus(sanitizedPayload.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid product status');
  }

  try {
    const updatePayload: Partial<IProduct> = {
      ...sanitizedPayload,
      ...syncProductStatusFields(sanitizedPayload.status),
    };

    if (hasImageFiles || existingMainPhoto || existingOtherPhotos) {
      const uploaded = await uploadProductPhotos(files);
      uploadedUrls = uploaded.uploadedUrls;

      const nextMainPhoto =
        uploaded.uploadResults.mainPhoto ||
        existingMainPhoto ||
        product.photos.mainPhoto;
      const nextOtherPhotos = [
        ...(existingOtherPhotos || product.photos.others || []),
        ...(uploaded.uploadResults.others || []),
      ];

      updatePayload.photos = {
        mainPhoto: nextMainPhoto,
        others: nextOtherPhotos,
      };

      const previousPhotos = [
        product.photos.mainPhoto,
        ...(product.photos.others || []),
      ].filter(Boolean);
      const nextPhotos = [nextMainPhoto, ...nextOtherPhotos].filter(Boolean);
      const removedPhotos = previousPhotos.filter(
        url => !nextPhotos.includes(url),
      );

      if (removedPhotos.length > 0) {
        await FileUploadHelper.deleteMultipleImagesByUrl(removedPhotos);
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updatePayload,
      {
        new: true,
        runValidators: true,
      },
    );

    return updatedProduct;
  } catch (error) {
    if (uploadedUrls.length > 0) {
      await FileUploadHelper.deleteMultipleImagesByUrl(uploadedUrls);
    }

    throw error;
  }
};

// Delete a product
const deleteProduct = async (
  id: string,
  userId: string,
  role: string,
): Promise<IProduct | null> => {
  const isExistProduct = await Product.findById(id);
  if (!isExistProduct) {
    throw new ApiError(httpStatus.NOT_FOUND, 'product not found');
  }

  const isAdmin =
    role === ENUM_USER_ROLE.ADMIN || role === ENUM_USER_ROLE.SUPER_ADMIN;

  if (!isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admin can delete products');
  }
  const allUrls = [
    isExistProduct?.photos.mainPhoto,
    ...(isExistProduct.photos.others || []),
  ].filter(Boolean) as string[];

  await FileUploadHelper.deleteMultipleImagesByUrl(allUrls);
  const result = await Product.findByIdAndDelete(id);
  return result;
};

export const productService = {
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
