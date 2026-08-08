import {
  bidRelationalFields,
  bidRelationalFieldsMapper,
  bidSearchableFields,
} from './order.constants';
import { Order } from './order.model';
import { IOrder, IOrderFilterableField } from './order.interface';
import { paginationHelpers } from '../../../helper/paginationHelper';
import { IGenericResponse } from '../../../shared/sendResponse';
import { IPaginationOptions } from '../../../inerfaces/pagination';
import { generateOrderNumber } from '../user/user.utils';

// const createOrder = async (data: any, user:IUser ): Promise<IOrder> => {
//     const orderNumber = await generateOrderNumber();
//     data.orderNumber = orderNumber
//     const result = await Order.create({
//         data
//     });

//     return result;
// };

// const createOrder = async (payload: IOrder,): Promise<IOrder | null> => {
//   const result = await Order.create(payload);
//   return result;
// };

const createOrder = async (payload: any): Promise<IOrder> => {
  const orderNumber = await generateOrderNumber();
  payload.orderNumber = orderNumber;
  const result = await Order.create({
    ...payload,
  });
  return result;
};

const getAllOrders = async (
  filters: IOrderFilterableField,
  options: IPaginationOptions,
): Promise<IGenericResponse<IOrder[]>> => {
  const { limit, page } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      OR: bidSearchableFields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map(key => {
        if (bidRelationalFields.includes(key)) {
          return {
            [bidRelationalFieldsMapper[key]]: {
              id: (filterData as any)[key],
            },
          };
        } else {
          return {
            [key]: {
              equals: (filterData as any)[key],
            },
          };
        }
      }),
    });
  }

  const result = await Order.find({
    // include: {
    //     product: true,
  });
  const total = await Order.countDocuments();

  return {
    meta: {
      total,
      page,
      limit,
    },
    data: result,
  };
};
const getMyOrders = async (
  filters: IOrderFilterableField,
  options: IPaginationOptions,
  userId: string,
): Promise<IGenericResponse<IOrder[]>> => {
  const { limit, page } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
    andConditions.push({
      OR: bidSearchableFields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map(key => {
        if (bidRelationalFields.includes(key)) {
          return {
            [bidRelationalFieldsMapper[key]]: {
              id: (filterData as any)[key],
            },
          };
        } else {
          return {
            [key]: {
              equals: (filterData as any)[key],
            },
          };
        }
      }),
    });
  }

  const result = await Order.find({ user: userId });
  const total = await Order.countDocuments();

  return {
    meta: {
      total,
      page,
      limit,
    },
    data: result,
  };
};

const getSingleOrder = async (id: string): Promise<IOrder | null> => {
  const result = await Order.findById(id);
  return result;
};

const updateOrder = async (
  id: string,
  payload: Partial<IOrder>,
): Promise<IOrder> => {
  await Order.updateOne({ _id: id }, payload);
  const updatedOrder = await Order.findById(id);
  if (!updatedOrder) {
    throw new Error('Order not found after update');
  }
  return updatedOrder;
};

const deleteOrder = async (id: string): Promise<IOrder> => {
  const deletedOrder = await Order.findByIdAndDelete(id);
  if (!deletedOrder) {
    throw new Error('Order not found');
  }
  return deletedOrder;
};

export const OrderService = {
  createOrder,
  getAllOrders,
  getSingleOrder,
  updateOrder,
  deleteOrder,
  getMyOrders,
};

// const createOrder = async (data: Order): Promise<{ bid: Bid; updatedProduct: Product }> => {
//     const existingBid = await prisma.bid.findFirst({
//         where: {
//             productId: data.productId,
//         },
//         orderBy: {
//             createdAt: 'desc',
//         },
//     });

//     if (existingBid && data.bidPrice <= existingBid.bidPrice) {
//         throw new ApiError(httpStatus.UNAUTHORIZED, 'Bid price must be higher than the current bid.');
//     }

//     const buyerExists = await prisma.user.findUnique({
//         where: {
//             id: data.userId,
//         },
//     });

//     if (!buyerExists) {
//         throw new ApiError(httpStatus.UNAUTHORIZED, 'You cannot bid without logged in user.');
//     }

//     const result = await prisma.$transaction(async (transactionClient) => {
//         const createdBid = await transactionClient.bid.create({
//             data,
//         });

//         const updatedProduct = await transactionClient.product.update({
//             where: {
//                 id: data.productId,
//             },
//             data: {
//                 bidPrice: data.bidPrice,
//                 totalBid: {
//                     increment: 1,
//                 },

//             },
//         });

//         return {
//             bid: createdBid,
//             updatedProduct,
//         };
//     });

//     return result;
// };
