import crypto from 'crypto';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { Order } from '../order/order.model';
import { User } from '../user/user.model';
import { Payment } from './payment.model';
import { AuctionSheetOrder } from '../auctionSheet/auctionSheet.model';
import { AuctionSheetService } from '../auctionSheet/auctionSheet.service';
import { EPSCheckout } from './eps.model';
import {
  assertEPSConfigured,
  initializeEPS,
  getEPSToken,
  EPSRejectedRequest,
  verifiedEPSStatus,
  verifyEPS,
} from './eps.gateway';

const frontend = () => {
  if (!config.frontend_url)
    throw new ApiError(503, 'FRONTEND_URL is required for EPS');
  return new URL('/payments', config.frontend_url);
};

const sync = async (reference: string, userId?: string) => {
  const checkout = await EPSCheckout.findOne({ reference });
  if (!checkout) throw new ApiError(404, 'EPS checkout not found');
  if (userId && checkout.userId !== userId)
    throw new ApiError(403, 'This payment belongs to another user');
  if (checkout.initializationState === 'REJECTED') {
    return { payment: { paymentStatus: 'FAILED' }, status: 'FAILED' };
  }
  const data =
    checkout.status === 'PAID'
      ? {
          MerchantTransactionId: reference,
          TotalAmount: checkout.amount.toFixed(2),
          Status: 'Success',
          EpsTransactionId: checkout.paidTransactionId,
        }
      : await verifyEPS(reference);
  const status = verifiedEPSStatus(data, reference, checkout.amount);
  // Paid is terminal. Conditional writes also prevent stale concurrent polls from downgrading it.
  await EPSCheckout.updateOne(
    { _id: checkout._id, reference, status: { $ne: 'PAID' } },
    {
      status,
      ...(status === 'PAID'
        ? { paidTransactionId: data.EpsTransactionId }
        : {}),
    },
  );
  const current = await EPSCheckout.findById(checkout._id);
  if (!current || current.reference !== reference)
    throw new ApiError(409, 'Checkout has changed; refresh payment status');
  if (current.status === 'PAID') {
    if (current.kind === 'auction-sheet') {
      await AuctionSheetOrder.updateOne(
        { _id: current.orderId, status: { $ne: 'PAID' } },
        {
          status: 'PAID',
          transactionId: current.paidTransactionId,
        },
      );
    } else {
      // Deterministic upsert and repeatable fulfillment repair interruptions between writes.
      await Payment.updateOne(
        { order: current.orderId, paymentMethod: 'eps' },
        {
          $set: {
            user: current.userId,
            amount: current.amount,
            currency: 'BDT',
            paymentStatus: 'PAID',
            transactionId: current.paidTransactionId,
            gateway: 'EPS',
          },
        },
        { upsert: true },
      );
      await Order.updateOne({ _id: current.orderId }, { isPending: false });
    }
  }
  return { payment: { paymentStatus: current.status }, status: current.status };
};

const init = async (
  kind: 'order' | 'auction-sheet',
  orderId: string,
  userId?: string,
) => {
  if (!/^[a-f\d]{24}$/i.test(orderId || ''))
    throw new ApiError(400, 'Valid order ID is required');
  const order: any =
    kind === 'order'
      ? await Order.findById(orderId)
      : await AuctionSheetService.getOrderById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (kind === 'order' && order.user.toString() !== userId)
    throw new ApiError(403, 'This order belongs to another user');
  if (kind === 'order' && order.serverPriced !== true)
    throw new ApiError(
      409,
      'Please create a new order so its price can be verified before EPS payment.',
    );
  if (
    order.status === 'PAID' ||
    (kind === 'order' && order.isPending === false)
  )
    throw new ApiError(409, 'Order is already paid');
  const user: any = kind === 'order' ? await User.findById(userId) : null;
  const amount = Number(kind === 'order' ? order.totalAmount : order.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.round(amount * 100) / 100 !== amount
  )
    throw new ApiError(400, 'Invalid stored order amount');
  const name =
    kind === 'order'
      ? order.buyerInfo?.name || user?.name || user?.businessName
      : order.name;
  const email =
    kind === 'order' ? order.buyerInfo?.email || user?.email : order.email;
  const phone =
    kind === 'order'
      ? order.buyerInfo?.phone || user?.whatsappNumber || user?.contactNo
      : order.mobileNumber;
  if (!name || !email || !phone)
    throw new ApiError(400, 'Customer name, email and phone are required');
  // Older order documents stored phone numbers numerically, dropping the leading zero.
  const rawPhone = String(phone).trim();
  const customerPhone = /^1[3-9]\d{8}$/.test(rawPhone) ? `0${rawPhone}` : rawPhone;
  frontend();
  if (!config.backend_url)
    throw new ApiError(503, 'BACKEND_URL is required for EPS returns');
  assertEPSConfigured();
  if (kind === 'auction-sheet')
    await AuctionSheetService.prepareAuctionSheetFile(orderId);

  const id = `${kind}:${orderId}`;
  let existing = await EPSCheckout.findById(id);
  if (existing) {
    await sync(existing.reference, userId);
    existing = await EPSCheckout.findById(id);
    if (existing?.status === 'PAID')
      throw new ApiError(409, 'Order is already paid');
    // EPS can report Cancel even for a newly-created, still-payable sandbox session.
    // Only a definite initialization rejection permits a new reference.
    if (existing?.initializationState !== 'REJECTED') {
      if (existing?.paymentUrl)
        return {
          payment_url: existing.paymentUrl,
          session_token: existing.reference,
          order_id: orderId,
        };
      throw new ApiError(
        409,
        'EPS checkout is still being confirmed. Contact support before creating another payment.',
      );
    }
  }
  const authToken = await getEPSToken();
  const reference = `${Date.now()}${crypto.randomBytes(8).toString('hex')}`;
  const record = {
    kind,
    orderId,
    userId,
    reference,
    amount,
    status: 'PENDING',
    paymentUrl: '',
    gatewayId: '',
    initializationState: 'INITIALIZING',
  };
  if (existing) {
    const claim = await EPSCheckout.updateOne(
      { _id: id, reference: existing.reference, status: 'FAILED' },
      { $set: record },
    );
    if (!claim.modifiedCount)
      throw new ApiError(409, 'Payment is being opened. Please refresh.');
  } else {
    try {
      await EPSCheckout.create({ _id: id, ...record });
    } catch (error: any) {
      if (error.code === 11000)
        throw new ApiError(409, 'Payment is being opened. Please refresh.');
      throw error;
    }
  }
  const returnUrl = (status: string) => {
    const url = new URL(
      `/api/v1/payment/eps/return/${reference}`,
      config.backend_url,
    );
    url.search = new URLSearchParams({ outcome: status }).toString();
    return url.toString();
  };
  const address = order.buyerInfo?.address;
  // Persist the reference BEFORE calling EPS. Never retry InitializeEPS after an ambiguous timeout.
  let session;
  try {
    session = await initializeEPS(
      {
        merchantTransactionId: reference,
        CustomerOrderId: reference,
        totalAmount: amount,
        successUrl: returnUrl('success'),
        failUrl: returnUrl('failed'),
        cancelUrl: returnUrl('cancelled'),
        customerName: name,
        customerEmail: email,
        customerPhone,
        customerAddress: address?.street || order.address || 'Bangladesh',
        customerCity: address?.city || 'Dhaka',
        customerState: address?.state || 'Dhaka',
        customerPostcode: String(address?.zipCode || '1000'),
        customerCountry: 'BD',
        productName:
          kind === 'auction-sheet'
            ? `Auction sheet ${order.chassis}`
            : `CarClickBD order ${order.orderNumber || orderId}`,
        noOfItem: '1',
        shippingMethod: 'NO',
        valueA: orderId,
      },
      authToken,
    );
  } catch (error) {
    const rejected = error instanceof EPSRejectedRequest;
    await EPSCheckout.updateOne(
      { _id: id, reference, status: { $ne: 'PAID' } },
      {
        initializationState: rejected ? 'REJECTED' : 'UNKNOWN',
        ...(rejected ? { status: 'FAILED' } : {}),
      },
    );
    throw error;
  }
  await EPSCheckout.updateOne(
    { _id: id, reference },
    {
      paymentUrl: session.paymentUrl,
      gatewayId: session.gatewayId,
      initializationState: 'READY',
    },
  );
  return {
    payment_url: session.paymentUrl,
    session_token: reference,
    order_id: orderId,
  };
};

const auctionStatus = async (orderId: string) => {
  const checkout = await EPSCheckout.findById(`auction-sheet:${orderId}`);
  const verified = checkout ? await sync(checkout.reference) : null;
  if (!config.backend_url) throw new ApiError(503, 'BACKEND_URL is required');
  const result = await AuctionSheetService.getPaymentStatus(
    orderId,
    config.backend_url.replace(/\/+$/, ''),
  );
  return {
    ...result,
    status: result.paid ? 'PAID' : verified?.status || result.status,
  };
};

const handleReturn = async (reference: string) => {
  const checkout = await EPSCheckout.findOne({ reference });
  if (!checkout) throw new ApiError(404, 'EPS checkout not found');
  let status = 'PENDING';
  try {
    status = (await sync(reference)).status;
  } catch {
    /* The return page will retry a temporary verification failure. */
  }
  const url = frontend();
  url.search = new URLSearchParams({
    provider: 'eps',
    token: reference,
    status: status.toLowerCase(),
    ...(checkout.kind === 'auction-sheet'
      ? { type: 'auction-sheet', payment_id: checkout.orderId }
      : { order: checkout.orderId }),
  }).toString();
  return url.toString();
};

export const EPSService = { init, sync, auctionStatus, handleReturn };
