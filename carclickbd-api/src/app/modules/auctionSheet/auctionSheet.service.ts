import fs from 'fs';
import path from 'path';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import config from '../../../config';
import { getUploadRoot } from '../../../helper/uploadPath';
import { Product } from '../product/product.model';
import {
  IAuctionSheetOrder,
  AuctionSheetOrderStatus,
} from './auctionSheet.interface';
import { AuctionSheetOrder } from './auctionSheet.model';

const normalizeChassis = (value: unknown) => {
  const chassis = String(value || '').trim().toUpperCase();
  if (!chassis || chassis.length > 80) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Chassis number is required and must be 80 characters or fewer',
    );
  }
  return chassis;
};

const normalizedFileName = (value: string) =>
  value.replace(/[^A-Z0-9_-]/gi, '').toLowerCase();

const compactFileName = (value: string) =>
  normalizedFileName(value).replace(/[_-]/g, '');

const getSheetRoot = () => {
  const configuredRoot = String(config.auction_sheet_root || '').trim();
  if (configuredRoot && configuredRoot !== '/auction-sheets') {
    return path.resolve(configuredRoot);
  }

  return path.join(getUploadRoot(), 'auction-sheets');
};

const findAuctionSheetFile = (chassis: string) => {
  const root = getSheetRoot();
  const safeNames = [
    normalizedFileName(chassis),
    compactFileName(chassis),
  ].filter(Boolean);
  const extensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

  for (const safeName of safeNames) {
    for (const extension of extensions) {
      const candidate = path.join(root, `${safeName}${extension}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const chassisDirectory = path.join(root, safeNames[0] || '');
  if (safeNames[0] && fs.existsSync(chassisDirectory)) {
    const nestedFile = fs
      .readdirSync(chassisDirectory)
      .find(file => extensions.includes(path.extname(file).toLowerCase()));
    if (nestedFile) return path.join(chassisDirectory, nestedFile);
  }

  return undefined;
};

const getReport = async (rawChassis: unknown) => {
  const chassis = normalizeChassis(rawChassis);
  const compactChassis = chassis.replace(/[^A-Z0-9]/gi, '');
  const chassisPattern = compactChassis
    .split('')
    .map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[- _]*');
  const product = compactChassis
    ? await Product.findOne({
        vinChassisNumber: { $regex: `^${chassisPattern}$`, $options: 'i' },
      })
        .select(
          'maker model title year productionYear mileage auctionGrade color condition photos.mainPhoto',
        )
        .lean()
    : null;
  const sheetFile = findAuctionSheetFile(chassis);

  return {
    chassis,
    found: Boolean(product),
    report: product
      ? {
          maker: product.maker,
          model: product.model,
          title: product.title,
          year: product.year,
          production_year: product.productionYear,
          mileage: product.mileage,
          auction_grade: product.auctionGrade,
          color: product.color,
          condition: product.condition,
        }
      : null,
    download_available: Boolean(sheetFile),
  };
};

const createOrder = async (payload: Partial<IAuctionSheetOrder>) => {
  const chassis = normalizeChassis(payload.chassis);
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const mobileNumber = String(payload.mobileNumber || '').trim();
  const address = String(payload.address || '').trim();

  if (!name || !email || !mobileNumber || !address) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'All customer details are required');
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Valid email is required');
  }
  if (!payload.termsAccepted) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Terms must be accepted');
  }

  const amount = Number(config.auction_sheet_price_bdt);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Auction sheet price is not configured');
  }

  return AuctionSheetOrder.create({
    chassis,
    normalizedChassis: normalizedFileName(chassis),
    name,
    email,
    mobileNumber,
    address,
    amount,
    currency: 'BDT',
    termsAccepted: true,
    status: 'PENDING',
  });
};

const getOrderById = async (id: string) => {
  const order = await AuctionSheetOrder.findById(id);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Auction sheet order not found');
  return order;
};

const updatePayment = async (params: {
  orderId?: string;
  sessionToken?: string;
  status: AuctionSheetOrderStatus;
  gatewayStatus?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}) => {
  const filters = [];
  if (params.orderId) filters.push({ _id: params.orderId });
  if (params.sessionToken) {
    filters.push({ bdgateSessionToken: params.sessionToken });
  }
  if (!filters.length) return null;

  const current = await AuctionSheetOrder.findOne({ $or: filters });
  if (!current || current.status === 'PAID') return current;

  current.status = params.status;
  current.bdgateStatus = params.gatewayStatus;
  current.transactionId = params.transactionId;
  current.metadata = params.metadata;
  await current.save();
  return current;
};

const getPaymentStatus = async (id: string, backendUrl: string) => {
  const order = await getOrderById(id);
  const sheetFile = findAuctionSheetFile(order.chassis);
  const paid = order.status === 'PAID';

  return {
    payment_id: order._id,
    status: order.status,
    paid,
    chassis: order.chassis,
    download_available: paid && Boolean(sheetFile),
    download_url:
      paid && sheetFile
        ? `${backendUrl}/api/v1/auction-sheet/download/${order._id}`
        : undefined,
  };
};

const getDownloadFile = async (id: string) => {
  const order = await getOrderById(id);
  if (order.status !== 'PAID') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Auction sheet is available after payment confirmation');
  }

  const filePath = findAuctionSheetFile(order.chassis);
  if (!filePath) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Auction sheet file is not available yet');
  }

  return { filePath, chassis: order.chassis };
};

export const AuctionSheetService = {
  normalizeChassis,
  getReport,
  createOrder,
  getOrderById,
  updatePayment,
  getPaymentStatus,
  getDownloadFile,
};
