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

const createBdGateHeaders = () => {
  const apiKey = config.bdgate.api_key || '';

  return {
    'Content-Type': 'application/json',
    // X-API-Key is used by the REST API reference, while the BDGate Pay
    // integration guide documents the Bearer form. Sending both keeps the
    // integration compatible with either account routing mode.
    'X-API-Key': apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const postToBdGate = async (path: string, payload: Record<string, unknown>) => {
  let lastReason = 'Unable to connect to BDGate';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch(getBdGateUrl(path), {
        method: 'POST',
        headers: createBdGateHeaders(),
        body: JSON.stringify(payload),
        // Keep the public payment flow below Hostinger's gateway timeout. A
        // stalled BDGate connection should produce a useful retry message,
        // not a browser-level generic "Network Error" after about a minute.
        signal: AbortSignal.timeout(10000),
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

const createBdGateSession = async (payload: Record<string, unknown>) => {
  // BDGate recommends the unified v1 checkout endpoint. Keep the older
  // BDGate Pay endpoint only as a compatibility fallback.
  const response = await postToBdGate('/v1/checkout', payload);
  if (
    response.status === httpStatus.NOT_FOUND ||
    response.status === httpStatus.METHOD_NOT_ALLOWED
  ) {
    return postToBdGate('/bdgate-pay/create-session', payload);
  }
  return response;
};

const getBdGateSessionStatus = async (sessionToken: string) => {
  let response = await fetch(
    getBdGateUrl(`/bdgate-pay/sessions/${encodeURIComponent(sessionToken)}`),
    {
      method: 'GET',
      headers: createBdGateHeaders(),
      signal: AbortSignal.timeout(10000),
    },
  );

  // Older BDGate Pay installations expose a public hosted-session endpoint.
  if (
    response.status === httpStatus.NOT_FOUND ||
    response.status === httpStatus.METHOD_NOT_ALLOWED
  ) {
    response = await fetch(
      getBdGateUrl(`/public/pay/${encodeURIComponent(sessionToken)}/status`),
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      },
    );
  }

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getBdGateErrorMessage(responseBody, response.status),
    );
  }

  return getBdGateResponseData(responseBody);
};

const getBdGateResponseData = (responseBody: any) =>
  responseBody?.data || responseBody;

const getBdGateErrorMessage = (responseBody: any, status: number) => {
  const errors = responseBody?.errors;
  const errorMessage = Array.isArray(errors)
    ? errors.find(error => typeof error === 'string') ||
      errors.find(error => typeof error?.message === 'string')?.message
    : typeof errors === 'string'
      ? errors
      : undefined;
  const message =
    responseBody?.message ||
    responseBody?.error ||
    responseBody?.detail ||
    errorMessage ||
    responseBody?.data?.message;

  return typeof message === 'string' && message.trim()
    ? message.trim()
    : `BDGate returned HTTP ${status}`;
};

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

const assertAuctionSheetSessionMatches = (
  order: any,
  bdGateData: any,
  expectedToken: string,
) => {
  const remoteToken = String(
    bdGateData?.session_token ||
      bdGateData?.session_id ||
      bdGateData?.token ||
      '',
  ).trim();
  if (remoteToken && remoteToken !== expectedToken) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'BDGate session token does not match this auction-sheet order',
    );
  }

  const remoteOrderId = String(
    bdGateData?.order_id || bdGateData?.metadata?.order_id || '',
  ).trim();
  if (remoteOrderId && remoteOrderId !== order._id.toString()) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'BDGate order reference does not match this auction-sheet order',
    );
  }

  const remoteAmount = Number(bdGateData?.amount);
  if (
    Number.isFinite(remoteAmount) &&
    Math.abs(remoteAmount - Number(order.amount)) > 0.009
  ) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'BDGate payment amount does not match this auction-sheet order',
    );
  }

  const remoteCurrency = String(bdGateData?.currency || '').toUpperCase();
  if (remoteCurrency && remoteCurrency !== 'BDT') {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'BDGate payment currency does not match this auction-sheet order',
    );
  }
};

const verifyBdGateSignature = (
  payload: unknown,
  signature?: string,
  rawBody?: Buffer,
) => {
  const secret = config.bdgate.webhook_secret;
  if (!secret) return !signature;
  if (!signature) return false;

  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody || Buffer.from(JSON.stringify(payload)))
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
  const webhookUrl =
    data?.webhook_url ||
    (backendUrl ? `${backendUrl}/api/v1/payment/bdgate/webhook` : undefined);
  const successUrl =
    data?.redirect_url ||
    data?.success_url ||
    `${frontendUrl}/payments?status=success&provider=bdgate&order=${order._id}`;

  const bdGatePayload = {
    amount: amount.toFixed(2),
    currency: 'BDT',
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    description:
      data?.description ||
      `CarClickBD order #${order.orderNumber || order._id}`,
    success_url: successUrl,
    fail_url:
      data?.fail_url ||
      `${frontendUrl}/payments?status=failed&provider=bdgate&order=${order._id}`,
    cancel_url:
      data?.cancel_url ||
      data?.fail_url ||
      `${frontendUrl}/payments?status=failed&provider=bdgate&order=${order._id}`,
    webhook_url: webhookUrl,
    metadata,
  };

  const response = await createBdGateSession(bdGatePayload);

  const responseBody = await response.json().catch(() => null);
  const bdGateData = getBdGateResponseData(responseBody);

  if (!response.ok) {
    console.error('[bdgate] checkout rejected', {
      status: response.status,
      message: getBdGateErrorMessage(responseBody, response.status),
      code: responseBody?.code,
    });
    throw new ApiError(
      response.status,
      `BDGate payment session creation failed: ${getBdGateErrorMessage(
        responseBody,
        response.status,
      )}`,
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
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Auction sheet order id is required',
    );
  }

  const order = await AuctionSheetService.getOrderById(orderId);
  if (order.status === 'PAID') {
    throw new ApiError(
      httpStatus.CONFLICT,
      'Auction sheet order is already paid',
    );
  }

  // The customer must never reach BDGate unless a validated PDF already
  // exists in persistent storage. This removes JPCenter from the post-payment
  // critical path.
  await AuctionSheetService.prepareAuctionSheetFile(orderId);

  if (order.bdgateSessionToken && order.bdgatePaymentUrl) {
    try {
      const existingSession = await getBdGateSessionStatus(
        order.bdgateSessionToken,
      );
      assertAuctionSheetSessionMatches(
        order,
        existingSession,
        order.bdgateSessionToken,
      );
      const existingStatus = mapBdGateStatus(existingSession?.status);

      if (existingStatus === 'PAID') {
        await AuctionSheetService.updatePayment({
          orderId: order._id?.toString(),
          sessionToken: order.bdgateSessionToken,
          status: 'PAID',
          gatewayStatus: existingSession?.status,
          transactionId:
            existingSession?.tx_ref ||
            existingSession?.transaction_id ||
            order.bdgateSessionToken,
          metadata: order.metadata,
        });
        throw new ApiError(
          httpStatus.CONFLICT,
          'Auction sheet order is already paid',
        );
      }

      if (existingStatus === 'PENDING') {
        return {
          order_id: order._id?.toString(),
          session_token: order.bdgateSessionToken,
          payment_url: order.bdgatePaymentUrl,
          reused: true,
        };
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.statusCode === httpStatus.CONFLICT
      ) {
        throw error;
      }
      // If BDGate status is temporarily unavailable, reuse the existing
      // checkout rather than creating two payable sessions for one order.
      return {
        order_id: order._id?.toString(),
        session_token: order.bdgateSessionToken,
        payment_url: order.bdgatePaymentUrl,
        reused: true,
      };
    }
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
  const webhookUrl =
    data?.webhook_url || `${backendUrl}/api/v1/payment/bdgate/webhook`;

  const bdGatePayload = {
    amount: order.amount,
    currency: 'BDT',
    order_id: paymentId,
    customer_name: order.name,
    customer_email: order.email,
    customer_phone: order.mobileNumber,
    description:
      data?.description ||
      `CarClickBD auction sheet verification for ${chassis}`,
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    webhook_url: webhookUrl,
    metadata,
  };

  const response = await createBdGateSession(bdGatePayload);

  const responseBody = await response.json().catch(() => null);
  const bdGateData = getBdGateResponseData(responseBody);

  if (!response.ok) {
    console.error('[bdgate] checkout rejected', {
      status: response.status,
      message: getBdGateErrorMessage(responseBody, response.status),
      code: responseBody?.code,
    });
    throw new ApiError(
      response.status,
      `BDGate payment session creation failed: ${getBdGateErrorMessage(
        responseBody,
        response.status,
      )}`,
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

const handleBdGateWebhook = async (
  payload: any,
  signature?: string,
  rawBody?: Buffer,
) => {
  if (!verifyBdGateSignature(payload, signature, rawBody)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid BDGate signature');
  }

  const gatewayData =
    payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const metadata = payload?.metadata || gatewayData?.metadata;
  const declaredPaymentStatus = mapBdGateStatus(
    payload?.status || gatewayData?.status,
    payload?.event || gatewayData?.event,
  );
  const orderId = metadata?.order_id || gatewayData?.order_id;
  const suppliedSessionToken =
    payload?.session_token ||
    gatewayData?.session_token ||
    gatewayData?.session_id;
  if (!suppliedSessionToken && !orderId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'BDGate payment reference missing',
    );
  }

  const orderBySession = suppliedSessionToken
    ? await AuctionSheetOrder.findOne({
        bdgateSessionToken: suppliedSessionToken,
      })
    : null;
  const orderById =
    orderId && mongoose.isValidObjectId(orderId)
      ? await AuctionSheetOrder.findById(orderId)
      : null;
  if (
    orderBySession &&
    orderById &&
    orderBySession._id.toString() !== orderById._id.toString()
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'BDGate webhook references two different auction-sheet orders',
    );
  }
  const auctionSheetOrder = orderBySession || orderById;

  if (
    auctionSheetOrder ||
    metadata?.payment_type === 'auction_sheet_verification'
  ) {
    if (!auctionSheetOrder) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Auction sheet order referenced by BDGate was not found',
      );
    }

    const storedSessionToken = auctionSheetOrder.bdgateSessionToken;
    if (!storedSessionToken) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Auction sheet order does not have a BDGate session',
      );
    }
    if (suppliedSessionToken && suppliedSessionToken !== storedSessionToken) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'BDGate session does not belong to this auction-sheet order',
      );
    }

    const verifiedStatus = await getBdGateSessionStatus(storedSessionToken);
    assertAuctionSheetSessionMatches(
      auctionSheetOrder,
      verifiedStatus,
      storedSessionToken,
    );
    const verifiedPaymentStatus = mapBdGateStatus(verifiedStatus?.status);
    if (declaredPaymentStatus === 'PAID' && verifiedPaymentStatus !== 'PAID') {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        'BDGate webhook arrived before the payment was confirmed',
      );
    }

    const transactionId =
      verifiedStatus?.tx_ref ||
      verifiedStatus?.transaction_id ||
      payload?.tx_ref ||
      gatewayData?.tx_ref ||
      storedSessionToken;
    return AuctionSheetService.updatePayment({
      orderId: auctionSheetOrder._id.toString(),
      sessionToken: storedSessionToken,
      status: verifiedPaymentStatus,
      gatewayStatus: payload?.status || gatewayData?.status,
      transactionId,
      metadata,
    });
  }

  let paymentStatus = declaredPaymentStatus;
  if (suppliedSessionToken) {
    const verifiedStatus = await getBdGateSessionStatus(suppliedSessionToken);
    paymentStatus = mapBdGateStatus(verifiedStatus?.status);
  }
  const transactionId =
    payload?.tx_ref ||
    gatewayData?.tx_ref ||
    gatewayData?.transaction_id ||
    suppliedSessionToken;

  const payment = await Payment.findOneAndUpdate(
    {
      $or: [
        ...(suppliedSessionToken
          ? [{ bdgateSessionToken: suppliedSessionToken }]
          : []),
        ...(orderId ? [{ order: orderId }] : []),
      ],
    },
    {
      paymentStatus,
      transactionId,
      bdgateSessionToken: suppliedSessionToken,
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
  const bdGateData = await getBdGateSessionStatus(sessionToken);

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

const syncBdGateAuctionSheetPaymentStatus = async (orderId: string) => {
  const order = await AuctionSheetService.getOrderById(orderId);
  if (
    !order.bdgateSessionToken ||
    order.status === 'PAID' ||
    order.status === 'FAILED' ||
    order.status === 'CANCELLED'
  ) {
    return order;
  }

  try {
    const bdGateData = await getBdGateSessionStatus(order.bdgateSessionToken);
    assertAuctionSheetSessionMatches(
      order,
      bdGateData,
      order.bdgateSessionToken,
    );
    const paymentStatus = mapBdGateStatus(bdGateData?.status);
    const transactionId =
      bdGateData?.tx_ref ||
      bdGateData?.transaction_id ||
      order.bdgateSessionToken;

    return AuctionSheetService.updatePayment({
      orderId: order._id?.toString(),
      sessionToken: order.bdgateSessionToken,
      status: paymentStatus,
      gatewayStatus: bdGateData?.status,
      transactionId,
      metadata: order.metadata,
    });
  } catch (error: any) {
    // A temporary BDGate status outage must not turn a paid order into a
    // failed order. The next poll or webhook retry can reconcile it.
    console.error('[bdgate] auction-sheet status sync failed', {
      orderId,
      message: error?.message || 'Unknown error',
    });
    return order;
  }
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
  syncBdGateAuctionSheetPaymentStatus,
  getAllFromDB,
  getByIdFromDB,
  createPayment,
};
