import Stripe from 'stripe';
import config from '../../../config';
import { IPayment, IPaymentFilterableField } from './payment.interface';
import { Payment } from './payment.model';
import { IPaginationOptions } from '../../../inerfaces/pagination';
import { IGenericResponse } from '../../../shared/sendResponse';
import { paginationHelpers } from '../../../helper/paginationHelper';
import { paymentSearchableFields } from './payment.constants';
import { Order } from '../order/order.model';
import { User } from '../user/user.model';
import mongoose from 'mongoose';
import ApiError from '../../../errors/ApiError';
import httpStatus from 'http-status';
import crypto from 'crypto';
import { AuctionSheetService } from '../auctionSheet/auctionSheet.service';
import { AuctionSheetOrder } from '../auctionSheet/auctionSheet.model';

const stripe = new Stripe(config?.stripe_secret_key as string);
const BDGATE_DEFAULT_API_BASE_URL = 'https://api.bdgate.net/api';

const getAppUrl = (value?: string) => value?.replace(/\/+$/, '');

const getBdGateApiBaseUrl = () =>
  getAppUrl(config.bdgate.api_base_url) || BDGATE_DEFAULT_API_BASE_URL;

const getBdGateUrl = (path: string) =>
  `${getBdGateApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

const createBdGateHeaders = () => ({
  'Content-Type': 'application/json',
  'X-API-Key': config.bdgate.api_key || '',
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const postToBdGate = async (path: string, payload: Record<string, unknown>) => {
  let lastReason = 'Unable to connect to BDGate';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch(getBdGateUrl(path), {
        method: 'POST',
        headers: createBdGateHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
    } catch (error: any) {
      lastReason = error?.cause?.message || error?.message || lastReason;

      if (attempt < 3) {
        await wait(attempt * 1500);
      }
    }
  }

  throw new ApiError(
    httpStatus.BAD_GATEWAY,
    `BDGate connection failed: ${lastReason}`,
  );
};

const getBdGateResponseData = (responseBody: any) =>
  responseBody?.data || responseBody;

const mapBdGateStatus = (
  status?: string,
  event?: string,
): 'PENDING' | 'PAID' | 'FAILED' => {
  const normalizedStatus = status?.toLowerCase();
  const normalizedEvent = event?.toLowerCase();

  if (
    normalizedStatus === 'paid' ||
    normalizedStatus === 'completed' ||
    normalizedStatus === 'success' ||
    normalizedEvent === 'payment.confirmed' ||
    normalizedEvent === 'payment.completed' ||
    normalizedEvent === 'completed'
  ) {
    return 'PAID';
  }

  if (
    normalizedStatus === 'failed' ||
    normalizedStatus === 'expired' ||
    normalizedStatus === 'cancelled' ||
    normalizedEvent === 'payment.failed'
  ) {
    return 'FAILED';
  }

  return 'PENDING';
};

const verifyBdGateSignature = (payload: unknown, signature?: string) => {
  const secret = config.bdgate.webhook_secret || config.bdgate.api_key;
  if (!secret || !signature) {
    return config.env !== 'production';
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const digestBuffer = Buffer.from(digest);
  const signatureBuffer = Buffer.from(signature.replace(/^sha256=/i, ''));

  return (
    digestBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(digestBuffer, signatureBuffer)
  );
};

const initStripePayment = async (data: any) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'link', 'alipay', 'us_bank_account'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(data?.items?.price * 100), // Access price from data.items
          product_data: {
            name: data?.items?.name, // Access name from data.items
            description: data?.items?.description, // Access description from data.items
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${data?.items?.success_url}&session_id={CHECKOUT_SESSION_ID}`, // Access success_url
    cancel_url: data?.items?.cancel_url || config?.frontend_url, // Access cancel_url
  });

  return { id: session.id };
};

const initBdGatePayment = async (data: any, userId: string) => {
  if (!config.bdgate.api_key) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'BDGate API key is not configured',
    );
  }

  const orderId = data?.order || data?.orderId || data?.items?.order;
  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Order id is required');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Order not found');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const amount = Number(
    data?.amount || data?.items?.price || order.totalAmount,
  );
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Valid payment amount is required',
    );
  }

  const frontendUrl = getAppUrl(config.frontend_url) || 'http://localhost:3000';
  const backendUrl = getAppUrl(config.backend_url);
  const customerName =
    order.buyerInfo?.name ||
    user.name ||
    user.businessName ||
    'CarClickBD Customer';
  const customerEmail = order.buyerInfo?.email || user.email;
  const customerPhone =
    String(
      order.buyerInfo?.phone || user.whatsappNumber || user.contactNo || '',
    ) || undefined;
  const metadata = {
    order_id: order._id.toString(),
    order_number: order.orderNumber,
    user_id: user._id.toString(),
  };

  const bdGatePayload = {
    amount: amount.toFixed(2),
    currency: 'BDT',
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    description:
      data?.description ||
      `CarClickBD order #${order.orderNumber || order._id}`,
    success_url:
      data?.redirect_url ||
      data?.success_url ||
      `${frontendUrl}/payments?status=success&provider=bdgate&order=${order._id}`,
    fail_url:
      data?.fail_url ||
      `${frontendUrl}/payments?status=failed&provider=bdgate&order=${order._id}`,
    cancel_url:
      data?.cancel_url ||
      data?.fail_url ||
      `${frontendUrl}/payments?status=failed&provider=bdgate&order=${order._id}`,
    webhook_url:
      data?.webhook_url ||
      (backendUrl ? `${backendUrl}/api/v1/payment/bdgate/webhook` : undefined),
    metadata,
  };

  const response = await postToBdGate('/v1/checkout', bdGatePayload);

  const responseBody = await response.json().catch(() => null);
  const bdGateData = getBdGateResponseData(responseBody);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      responseBody?.message || 'BDGate payment session creation failed',
    );
  }

  const sessionToken =
    bdGateData?.session_token ||
    bdGateData?.session_id ||
    bdGateData?.sessionId ||
    bdGateData?.transaction_id ||
    bdGateData?.transactionId ||
    bdGateData?.sessionToken ||
    bdGateData?.token ||
    bdGateData?.id;
  const paymentUrl =
    bdGateData?.payment_url ||
    bdGateData?.paymentUrl ||
    bdGateData?.redirect_url ||
    bdGateData?.redirectUrl ||
    bdGateData?.checkoutUrl ||
    bdGateData?.checkout_url ||
    bdGateData?.url;

  if (!paymentUrl) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'BDGate payment URL was not returned',
    );
  }

  await Payment.findOneAndUpdate(
    {
      order: order._id,
      paymentMethod: 'bdgate',
      paymentStatus: 'PENDING',
    },
    {
      user: user._id,
      order: order._id,
      amount,
      currency: data?.currency || 'BDT',
      transactionId: sessionToken,
      paymentMethod: 'bdgate',
      paymentStatus: 'PENDING',
      bdgateSessionToken: sessionToken,
      bdgatePaymentUrl: paymentUrl,
      bdgateStatus: 'pending',
      metadata,
    },
    { upsert: true, new: true },
  );

  return {
    ...bdGateData,
    session_token: sessionToken,
    payment_url: paymentUrl,
  };
};

const initBdGateAuctionSheetPayment = async (data: any) => {
  if (!config.bdgate.api_key) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'BDGate API key is not configured',
    );
  }

  const orderId = data?.orderId || data?.order_id;
  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Auction sheet order id is required');
  }

  const order = await AuctionSheetService.getOrderById(orderId);
  if (order.status === 'PAID') {
    throw new ApiError(httpStatus.CONFLICT, 'Auction sheet order is already paid');
  }

  const frontendUrl = getAppUrl(config.frontend_url) || 'http://localhost:3000';
  const backendUrl = getAppUrl(data?.backend_url || config.backend_url);
  if (!backendUrl) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'BACKEND_URL is required for BDGate webhook delivery',
    );
  }

  const paymentId = order._id?.toString();
  const chassis = order.chassis;
  const metadata = {
    order_id: paymentId,
    payment_type: 'auction_sheet_verification',
    source: 'auction-sheet-verification',
    chassis_no: chassis,
  };
  const successUrl = `${frontendUrl}/payments?status=success&provider=bdgate&type=auction-sheet&payment_id=${paymentId}&chassis=${encodeURIComponent(chassis)}`;
  const failUrl = `${frontendUrl}/payments?status=failed&provider=bdgate&type=auction-sheet&payment_id=${paymentId}&chassis=${encodeURIComponent(chassis)}`;
  const cancelUrl = `${frontendUrl}/payments?status=cancelled&provider=bdgate&type=auction-sheet&payment_id=${paymentId}&chassis=${encodeURIComponent(chassis)}`;

  const bdGatePayload = {
    amount: order.amount,
    currency: 'BDT',
    customer_name: order.name,
    customer_email: order.email,
    description: data?.description || `CarClickBD auction sheet verification for ${chassis}`,
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    webhook_url: data?.webhook_url || `${backendUrl}/api/v1/payment/bdgate/webhook`,
    metadata,
  };

  const response = await postToBdGate('/v1/checkout', bdGatePayload);

  const responseBody = await response.json().catch(() => null);
  const bdGateData = getBdGateResponseData(responseBody);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      responseBody?.message || 'BDGate payment session creation failed',
    );
  }

  const sessionToken =
    bdGateData?.session_token ||
    bdGateData?.session_id ||
    bdGateData?.sessionId ||
    bdGateData?.transaction_id ||
    bdGateData?.transactionId ||
    bdGateData?.sessionToken ||
    bdGateData?.token ||
    bdGateData?.id;
  const paymentUrl =
    bdGateData?.payment_url ||
    bdGateData?.paymentUrl ||
    bdGateData?.redirect_url ||
    bdGateData?.redirectUrl ||
    bdGateData?.checkoutUrl ||
    bdGateData?.checkout_url ||
    bdGateData?.url;

  if (!paymentUrl || !sessionToken) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'BDGate did not return a payment URL and session token',
    );
  }

  await AuctionSheetOrder.findByIdAndUpdate(order._id, {
    bdgateSessionToken: sessionToken,
    bdgatePaymentUrl: paymentUrl,
    bdgateStatus: 'pending',
    transactionId: sessionToken,
    metadata,
  });

  return {
    ...bdGateData,
    order_id: paymentId,
    session_token: sessionToken,
    payment_url: paymentUrl,
  };
};

const updateOrderAfterPaidPayment = async (orderId?: string) => {
  if (!orderId) {
    return;
  }

  await Order.findByIdAndUpdate(orderId, { isPending: false });
};

const handleBdGateWebhook = async (payload: any, signature?: string) => {
  if (!verifyBdGateSignature(payload, signature)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid BDGate signature');
  }

  const gatewayData =
    payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const metadata = payload?.metadata || gatewayData?.metadata;
  const paymentStatus = mapBdGateStatus(
    payload?.status || gatewayData?.status,
    payload?.event || gatewayData?.event,
  );
  const orderId = metadata?.order_id || gatewayData?.order_id;
  const sessionToken =
    payload?.session_token || gatewayData?.session_token || gatewayData?.session_id;
  const transactionId =
    payload?.tx_ref ||
    gatewayData?.tx_ref ||
    gatewayData?.transaction_id ||
    sessionToken;

  if (!sessionToken && !orderId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'BDGate payment reference missing',
    );
  }

  const auctionSheetOrder =
    (orderId && mongoose.isValidObjectId(orderId)
      ? await AuctionSheetOrder.findById(orderId)
      : null) ||
    (sessionToken
      ? await AuctionSheetOrder.findOne({ bdgateSessionToken: sessionToken })
      : null);

  if (auctionSheetOrder || metadata?.payment_type === 'auction_sheet_verification') {
    const updatedOrder = await AuctionSheetService.updatePayment({
      orderId,
      sessionToken,
      status: paymentStatus,
      gatewayStatus: payload?.status || gatewayData?.status,
      transactionId,
      metadata,
    });
    return updatedOrder;
  }

  const payment = await Payment.findOneAndUpdate(
    {
      $or: [
        ...(sessionToken ? [{ bdgateSessionToken: sessionToken }] : []),
        ...(orderId ? [{ order: orderId }] : []),
      ],
    },
    {
      paymentStatus,
      transactionId,
      bdgateSessionToken: sessionToken,
      bdgateStatus: payload?.status || gatewayData?.status,
      gateway: payload?.gateway || gatewayData?.gateway,
      amount: payload?.amount || gatewayData?.amount,
      currency: payload?.currency || gatewayData?.currency || 'BDT',
      paymentMethod: 'bdgate',
      metadata,
    },
    { new: true },
  );

  if (paymentStatus === 'PAID') {
    await updateOrderAfterPaidPayment(orderId || payment?.order?.toString());
  }

  return payment;
};

const syncBdGatePaymentStatus = async (sessionToken: string) => {
  const response = await postToBdGate('/payment/verify', {
    transaction_id: sessionToken,
    session_id: sessionToken,
  });
  const responseBody = await response.json().catch(() => null);
  const bdGateData = getBdGateResponseData(responseBody);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      responseBody?.message || 'BDGate payment status check failed',
    );
  }

  const paymentStatus = mapBdGateStatus(bdGateData?.status);
  const payment = await Payment.findOneAndUpdate(
    { bdgateSessionToken: sessionToken },
    {
      paymentStatus,
      bdgateStatus: bdGateData?.status,
      gateway: bdGateData?.gateway,
      transactionId:
        bdGateData?.tx_ref || bdGateData?.transaction_id || sessionToken,
    },
    { new: true },
  );

  if (paymentStatus === 'PAID') {
    await updateOrderAfterPaidPayment(payment?.order?.toString());
  }

  return { bdgate: bdGateData, payment };
};

// const createPayment = async (payload: IPayment): Promise<IPayment> => {
//   const existingPayment = await Payment.findOne({ transactionId: payload.transactionId });
//   if (existingPayment) {
//       throw new Error("Payment with this transactionId already exists.");
//   }

//   const result = await Payment.create(payload);
//   return result;
// };

const createPayment = async (payload: IPayment): Promise<IPayment> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingPayment = await Payment.findOne({
      transactionId: payload.transactionId,
    }).session(session);
    if (existingPayment) {
      await session.abortTransaction();
      session.endSession();
      throw new Error('Payment with this transactionId already exists.');
    }

    const payment = await Payment.create([payload], { session });

    const order = await Order.findById(payload.order).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(`Order with ID ${payload.order} not found.`);
    }
    order.isPending = false;
    await order.save({ session });

    const user = await User.findById(payload.user).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(`User with ID ${payload.user} not found.`);
    }

    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    return payment[0]; // Payment.create returns an array
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating payment and updating order/user:', error);
    throw error;
  }
};

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

export const PaymentService = {
  initStripePayment,
  initBdGatePayment,
  initBdGateAuctionSheetPayment,
  handleBdGateWebhook,
  syncBdGatePaymentStatus,
  getAllFromDB,
  getByIdFromDB,
  createPayment,
};
