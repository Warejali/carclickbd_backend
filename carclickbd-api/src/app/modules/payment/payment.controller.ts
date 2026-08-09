import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import pick from '../../../shared/pick';
import sendResponse, { IGenericResponse } from '../../../shared/sendResponse';
import { paymentFilterableFields } from './payment.constants';
import { PaymentService } from './payment.service';
import { IPayment, IPaymentFilterableField } from './payment.interface';
import { paginationFields } from '../../../constant/pagination';
import { JwtPayload } from 'jsonwebtoken';

const initPayment = catchAsync(async (req: Request, res: Response) => {
  const { ...data } = req.body;
  const session = await PaymentService.initStripePayment(data);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Payment init successfully',
    data: {
      id: session.id,
    },
  });
});

const initBdGatePayment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const forwardedProtocol = req.headers['x-forwarded-proto'] as
    | string
    | undefined;
  const protocol = forwardedProtocol?.split(',')[0] || req.protocol;
  const backendUrl = `${protocol}://${req.get('host')}`;
  const result = await PaymentService.initBdGatePayment(
    {
      ...req.body,
      webhook_url:
        req.body.webhook_url || `${backendUrl}/api/v1/payment/bdgate/webhook`,
    },
    user.userId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'BDGate payment init successfully',
    data: result,
  });
});

const initBdGateAuctionSheetPayment = catchAsync(
  async (req: Request, res: Response) => {
    const forwardedProtocol = req.headers['x-forwarded-proto'] as
      | string
      | undefined;
    const protocol = forwardedProtocol?.split(',')[0] || req.protocol;
    const backendUrl = `${protocol}://${req.get('host')}`;
    const result = await PaymentService.initBdGateAuctionSheetPayment({
      ...req.body,
      webhook_url:
        req.body.webhook_url || `${backendUrl}/api/v1/payment/bdgate/webhook`,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'BDGate auction sheet payment init successfully',
      data: result,
    });
  },
);

const bdGateWebhook = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.handleBdGateWebhook(
    req.body,
    req.headers['x-bdgate-signature'] as string | undefined,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'BDGate webhook processed successfully',
    data: result,
  });
});

const syncBdGatePaymentStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await PaymentService.syncBdGatePaymentStatus(
      req.params.token,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: 'BDGate payment status synced successfully',
      data: result,
    });
  },
);

const createPayment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const payload = { ...req.body, user: user.userId };

  console.log(payload, 'payload', req.body);

  const result = await PaymentService.createPayment(payload);
  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Payment successfully',
    data: result,
  });
});

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

export const PaymentController = {
  initPayment,
  initBdGatePayment,
  initBdGateAuctionSheetPayment,
  bdGateWebhook,
  syncBdGatePaymentStatus,
  getAllFromDB,
  getByIdFromDB,
  createPayment,
};
