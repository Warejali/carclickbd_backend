import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import pick from '../../../shared/pick';
import sendResponse, { IGenericResponse } from '../../../shared/sendResponse';
import { orderIdFilterableFields } from './order.constants';
import { OrderService } from './order.service';
import { JwtPayload } from 'jsonwebtoken';
import { IOrder, IOrderFilterableField } from './order.interface';
import { paginationFields } from '../../../constant/pagination';
import { IPaginationOptions } from '../../../inerfaces/pagination';

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const payload = { ...req.body, user: user.userId };
  const result = await OrderService.createOrder(payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'order created successfully',
    data: result,
  });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(
    req.query,
    orderIdFilterableFields,
  ) as IOrderFilterableField;
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);

  const result = await OrderService.getAllOrders(filters, options);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Get All bid successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const query = req.query;
  const option = pick(query, paginationFields) as IPaginationOptions;
  const filters = pick(
    query,
    orderIdFilterableFields,
  ) as unknown as IOrderFilterableField;

  const result = await OrderService.getMyOrders(filters, option, user.userId);
  sendResponse<IGenericResponse<IOrder[]>>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products fetched successfully!',
    meta: result.meta,
    data: result.data as any,
  });
});

const getSingleOrder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await OrderService.getSingleOrder(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Get successfully',
    data: result,
  });
});

const updateOrder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body;
  const result = await OrderService.updateOrder(id, payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product updated successfully',
    data: result,
  });
});

const deleteOrder = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await OrderService.deleteOrder(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product deleted successfully',
    data: result,
  });
});

//delete all

export const OrderController = {
  deleteOrder,
  updateOrder,
  getSingleOrder,
  createOrder,
  getAllOrders,
  getMyOrders,
};
