import { IPayment, IPaymentFilterableField } from './payment.interface';
import { Payment } from './payment.model';
import { IPaginationOptions } from '../../../inerfaces/pagination';
import { IGenericResponse } from '../../../shared/sendResponse';
import { paginationHelpers } from '../../../helper/paginationHelper';
import { paymentSearchableFields } from './payment.constants';

const getAllFromDB = async (
  paginationOption: IPaginationOptions,
  filters: IPaymentFilterableField,
): Promise<IGenericResponse<IPayment[]>> => {
  const { limit, page, skip, sortBy, sortOrder } =
    paginationHelpers.calculatePagination(paginationOption);

  const { searchTerm } = filters;

  const andConditions = [];
  if (searchTerm) {
    andConditions.push({
      $or: paymentSearchableFields.map(field => ({
        [field]: {
          $regex: searchTerm,
          $options: 'i',
        },
      })),
    });
  }

  const result = await Payment.find({ $and: andConditions })
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);

  const total = await Payment.countDocuments({ $and: andConditions });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

const getByIdFromDB = async (id: string): Promise<IPayment | null> => {
  const result = await Payment.findOne({
    _id: id,
  });
  return result;
};

export const PaymentService = { getAllFromDB, getByIdFromDB };
