import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import pick from '../../../shared/pick';
import sendResponse, { IGenericResponse } from '../../../shared/sendResponse';
import { paymentFilterableFields } from './payment.constants';
import { PaymentService } from './payment.service';
import { IPayment, IPaymentFilterableField } from './payment.interface';
import { paginationFields } from '../../../constant/pagination';

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const paginationOption = pick(query, paginationFields);
  const filters = pick(
    query,
    paymentFilterableFields,
  ) as unknown as IPaymentFilterableField;

  const result = await PaymentService.getAllFromDB(paginationOption, filters);
  sendResponse<IGenericResponse<IPayment[]>>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products fetched successfully!',
    meta: result.meta,
    data: result.data as any,
  });
});

const getByIdFromDB = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await PaymentService.getByIdFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment fetched successfully',
    data: result,
  });
});

export const PaymentController = { getAllFromDB, getByIdFromDB };
