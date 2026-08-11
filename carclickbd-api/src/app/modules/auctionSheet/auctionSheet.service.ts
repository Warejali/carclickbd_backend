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
  const chassis = String(value || '')
    .trim()
    .toUpperCase();
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

const firstValue = (...values: unknown[]) =>
  values.find(value => {
    if (value === undefined || value === null) return false;
    return String(value).trim() !== '';
  });

const isAllowedJpcenterFileUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const allowedHost =
      hostname === 'jpcenter.ru' ||
      hostname.endsWith('.jpcenter.ru') ||
      hostname === 'ajes.com' ||
      hostname.endsWith('.ajes.com');
    return (
      url.protocol === 'https:' && allowedHost && /\.pdf$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
};

const findPdfUrl = (value: unknown): string | undefined => {
  const seen = new Set<unknown>();

  const visit = (current: unknown): string | undefined => {
    if (typeof current === 'string') {
      const normalized = current.replace(/\\\//g, '/');
      if (isAllowedJpcenterFileUrl(normalized)) return normalized;

      const matches = normalized.match(
        /https:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi,
      );
      return matches?.find(isAllowedJpcenterFileUrl);
    }

    if (!current || typeof current !== 'object' || seen.has(current)) {
      return undefined;
    }
    seen.add(current);

    for (const nested of Object.values(current as Record<string, unknown>)) {
      const result = visit(nested);
      if (result) return result;
    }
    return undefined;
  };

  return visit(value);
};

const getJpcenterPdfUrl = async (chassis: string, recordKey: string) => {
  const apiCode = String(config.jpcenter.api_code || '').trim();
  if (!apiCode || !recordKey) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'JPCenter report access is not configured',
    );
  }

  const url = new URL(config.jpcenter.api_base_url);
  url.searchParams.set('json', '');
  url.searchParams.set('code', apiCode);
  url.searchParams.set('chassis', chassis.replace(/[^A-Z0-9-]/gi, ''));
  url.searchParams.set('key', recordKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  const responseText = await response.text();
  let responseBody: unknown = responseText;

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    // Some JPCenter responses contain HTML with the PDF link.
  }

  if (!response.ok) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      `JPCenter report request failed (HTTP ${response.status})`,
    );
  }

  const pdfUrl = findPdfUrl(responseBody);
  if (!pdfUrl) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'JPCenter returned the report but no PDF download link was found',
    );
  }
  return pdfUrl;
};

const fetchRemotePdf = async (pdfUrl: string) => {
  if (!isAllowedJpcenterFileUrl(pdfUrl)) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Invalid auction sheet URL');
  }

  const response = await fetch(pdfUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      `Auction sheet download failed (HTTP ${response.status})`,
    );
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  const maxBytes = 30 * 1024 * 1024;
  if (contentLength > maxBytes) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'Auction sheet file is too large',
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (
    buffer.length > maxBytes ||
    buffer.subarray(0, 5).toString() !== '%PDF-'
  ) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'JPCenter returned an invalid auction sheet PDF',
    );
  }

  return {
    buffer,
    contentType: response.headers.get('content-type') || 'application/pdf',
  };
};

const getJpcenterReport = async (chassis: string) => {
  const apiCode = String(config.jpcenter.api_code || '').trim();
  if (!apiCode) return null;

  const lookupChassis = chassis.replace(/[^A-Z0-9-]/gi, '');
  if (!lookupChassis) return null;

  const url = new URL(config.jpcenter.api_base_url);
  url.searchParams.set('json', '');
  url.searchParams.set('code', apiCode);
  url.searchParams.set('chassis', lookupChassis);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });
    const responseText = await response.text();
    let responseBody: any;

    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = null;
    }

    if (!response.ok || responseBody?.error) {
      console.error('[jpcenter] lookup rejected', {
        status: response.status,
        message: responseBody?.error || `HTTP ${response.status}`,
      });
      return null;
    }

    const records: Record<string, any>[] = Array.isArray(responseBody?.aj)
      ? responseBody.aj.filter(
          (record: unknown) => record && typeof record === 'object',
        )
      : [];
    const record = records.find(item => String(item.key || '').trim()) as
      | Record<string, any>
      | undefined;
    if (!record) return null;

    const images = Array.isArray(record.images)
      ? record.images.filter((image: unknown) => typeof image === 'string')
      : [];

    return {
      source: 'JPCenter',
      maker: firstValue(
        record.maker,
        record.make,
        record.manufacturer,
        record.car_maker,
      ),
      model: firstValue(record.car_model, record.model, record.carModel),
      title: firstValue(record.title, record.car_model, record.model),
      year: firstValue(
        record.car_year,
        record.year,
        record.production_year,
        record.productionYear,
      ),
      production_year: firstValue(
        record.car_year,
        record.production_year,
        record.productionYear,
        record.year,
      ),
      mileage: firstValue(record.mileage, record.car_mileage),
      auction_grade: firstValue(
        record.car_grade,
        record.grade,
        record.auction_grade,
      ),
      color: firstValue(record.car_color, record.color, record.colour),
      condition: firstValue(
        record.car_result,
        record.result,
        record.status,
        record.condition,
      ),
      image: firstValue(record.image, images[0]),
      images,
      record_key: String(record.key || '').trim(),
      history: records.map(item =>
        Object.fromEntries(
          Object.entries(item).filter(([field]) => field !== 'key'),
        ),
      ),
    };
  } catch (error: any) {
    console.error('[jpcenter] lookup failed', {
      message: error?.cause?.message || error?.message || 'Unknown error',
    });
    return null;
  }
};

const getReport = async (rawChassis: unknown) => {
  const chassis = normalizeChassis(rawChassis);
  const compactChassis = chassis.replace(/[^A-Z0-9]/gi, '');
  const chassisPattern = compactChassis
    .split('')
    .map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[- _]*');
  const jpcenterReport = await getJpcenterReport(chassis);
  const product =
    !jpcenterReport && compactChassis
      ? await Product.findOne({
          vinChassisNumber: { $regex: `^${chassisPattern}$`, $options: 'i' },
        })
          .select(
            'maker model title year productionYear mileage auctionGrade color condition photos.mainPhoto',
          )
          .lean()
      : null;
  const sheetFile = findAuctionSheetFile(chassis);
  const jpcenterRecordKey = String(jpcenterReport?.record_key || '').trim();
  const publicJpcenterReport = jpcenterReport
    ? Object.fromEntries(
        Object.entries(jpcenterReport).filter(
          ([field]) => field !== 'record_key',
        ),
      )
    : null;

  return {
    chassis,
    found: Boolean(publicJpcenterReport || product),
    report:
      publicJpcenterReport ||
      (product
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
        : null),
    download_available: Boolean(sheetFile || jpcenterRecordKey),
  };
};

const createOrder = async (payload: Partial<IAuctionSheetOrder>) => {
  const chassis = normalizeChassis(payload.chassis);
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '')
    .trim()
    .toLowerCase();
  const mobileNumber = String(payload.mobileNumber || '').trim();
  const address = String(payload.address || '').trim();

  if (!name || !email || !mobileNumber || !address) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'All customer details are required',
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Valid email is required');
  }
  if (!payload.termsAccepted) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Terms must be accepted');
  }

  const localSheetFile = findAuctionSheetFile(chassis);
  const jpcenterReport = localSheetFile
    ? null
    : await getJpcenterReport(chassis);
  const jpcenterRecordKey = String(jpcenterReport?.record_key || '').trim();

  if (!localSheetFile && !jpcenterRecordKey) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Auction sheet is not available from JPCenter for this chassis. Payment was not created',
    );
  }

  const amount = Number(config.auction_sheet_price_bdt);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Auction sheet price is not configured',
    );
  }

  const createdOrder = await AuctionSheetOrder.create({
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
    jpcenterRecordKey: jpcenterRecordKey || undefined,
  });

  return AuctionSheetOrder.findById(createdOrder._id);
};

const getOrderById = async (id: string) => {
  const order = await AuctionSheetOrder.findById(id).select(
    '+jpcenterRecordKey +jpcenterPdfUrl',
  );
  if (!order)
    throw new ApiError(httpStatus.NOT_FOUND, 'Auction sheet order not found');
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
  if (paid && !sheetFile && !order.jpcenterRecordKey && !order.jpcenterPdfUrl) {
    const jpcenterReport = await getJpcenterReport(order.chassis);
    const recoveredKey = String(jpcenterReport?.record_key || '').trim();
    if (recoveredKey) {
      order.jpcenterRecordKey = recoveredKey;
      await order.save();
    }
  }
  const remoteAvailable = Boolean(
    order.jpcenterRecordKey || order.jpcenterPdfUrl,
  );

  return {
    payment_id: order._id,
    status: order.status,
    paid,
    chassis: order.chassis,
    download_available: paid && Boolean(sheetFile || remoteAvailable),
    download_url:
      paid && (sheetFile || remoteAvailable)
        ? `${backendUrl}/api/v1/auction-sheet/download/${order._id}`
        : undefined,
  };
};

const getDownloadFile = async (id: string) => {
  const order = await getOrderById(id);
  if (order.status !== 'PAID') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Auction sheet is available after payment confirmation',
    );
  }

  const filePath = findAuctionSheetFile(order.chassis);
  if (filePath) return { filePath, chassis: order.chassis };

  if (!order.jpcenterRecordKey && !order.jpcenterPdfUrl) {
    const jpcenterReport = await getJpcenterReport(order.chassis);
    const recoveredKey = String(jpcenterReport?.record_key || '').trim();
    if (recoveredKey) {
      order.jpcenterRecordKey = recoveredKey;
      await order.save();
    }
  }

  let pdfUrl = String(order.jpcenterPdfUrl || '').trim();
  if (!pdfUrl && order.jpcenterRecordKey) {
    pdfUrl = await getJpcenterPdfUrl(order.chassis, order.jpcenterRecordKey);
    order.jpcenterPdfUrl = pdfUrl;
    order.jpcenterReportFetchedAt = new Date();
    await order.save();
  }

  if (!pdfUrl) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Auction sheet is not available from JPCenter',
    );
  }

  const remoteFile = await fetchRemotePdf(pdfUrl);
  return { ...remoteFile, chassis: order.chassis };
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
