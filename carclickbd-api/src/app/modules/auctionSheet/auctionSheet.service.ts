import fs from 'fs';
import https from 'https';
import path from 'path';
import httpStatus from 'http-status';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import ApiError from '../../../errors/ApiError';
import config from '../../../config';
import { getUploadRoot, getUploadRoots } from '../../../helper/uploadPath';
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

const preparationByChassis = new Map<string, Promise<string>>();

const isValidLocalSheetFile = (filePath: string) => {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < 100) return false;

    if (path.extname(filePath).toLowerCase() === '.pdf') {
      const descriptor = fs.openSync(filePath, 'r');
      const signature = Buffer.alloc(5);
      fs.readSync(descriptor, signature, 0, signature.length, 0);
      fs.closeSync(descriptor);
      return signature.toString() === '%PDF-';
    }

    return true;
  } catch {
    return false;
  }
};

const getSheetRoot = () => {
  const configuredRoot = String(config.auction_sheet_root || '').trim();
  const publicRoots = getUploadRoots().map(root => path.resolve(root));
  const configuredPath = configuredRoot
    ? path.resolve(configuredRoot)
    : undefined;
  const isPublicPath = configuredPath
    ? publicRoots.some(publicRoot => {
        const relative = path.relative(publicRoot, configuredPath);
        return (
          relative === '' ||
          (!relative.startsWith('..') && !path.isAbsolute(relative))
        );
      })
    : false;

  if (configuredPath && !isPublicPath) {
    return configuredPath;
  }

  // Auction sheets are paid files. Never place them under a directory exposed
  // by Express at /uploads, even if an old environment variable points there.
  return path.join(path.dirname(getUploadRoot()), 'carclickbd-auction-sheets');
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
      if (isValidLocalSheetFile(candidate)) return candidate;
    }
  }

  const chassisDirectory = path.join(root, safeNames[0] || '');
  if (safeNames[0] && fs.existsSync(chassisDirectory)) {
    const nestedFile = fs
      .readdirSync(chassisDirectory)
      .find(file => extensions.includes(path.extname(file).toLowerCase()));
    if (nestedFile) {
      const nestedPath = path.join(chassisDirectory, nestedFile);
      if (isValidLocalSheetFile(nestedPath)) return nestedPath;
    }
  }

  return undefined;
};

const firstValue = (...values: unknown[]) =>
  values.find(value => {
    if (value === undefined || value === null) return false;
    return String(value).trim() !== '';
  });

const isAllowedJpcenterAssetUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const allowedHost =
      hostname === 'jpcenter.ru' ||
      hostname.endsWith('.jpcenter.ru') ||
      hostname === 'ajes.com' ||
      hostname.endsWith('.ajes.com');
    return url.protocol === 'https:' && allowedHost;
  } catch {
    return false;
  }
};

const isAllowedJpcenterPdfUrl = (rawUrl: string) => {
  if (!isAllowedJpcenterAssetUrl(rawUrl)) return false;
  return /\.pdf$/i.test(new URL(rawUrl).pathname);
};

const findPdfUrl = (value: unknown): string | undefined => {
  const seen = new Set<unknown>();

  const visit = (current: unknown): string | undefined => {
    if (typeof current === 'string') {
      const normalized = current.replace(/\\\//g, '/');
      if (isAllowedJpcenterPdfUrl(normalized)) return normalized;

      const matches = normalized.match(
        /https:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?/gi,
      );
      return matches?.find(isAllowedJpcenterPdfUrl);
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

const findReportImageUrls = (value: unknown) => {
  if (!value || typeof value !== 'object') return [];

  const reports = Array.isArray((value as any).aj) ? (value as any).aj : [];
  const urls = reports.flatMap((report: unknown) => {
    if (!report || typeof report !== 'object') return [];

    return Object.entries(report as Record<string, unknown>)
      .filter(
        ([field, images]) => /^images/i.test(field) && Array.isArray(images),
      )
      .flatMap(([, images]) => images as unknown[])
      .filter((image): image is string => typeof image === 'string')
      .map(image => image.replace(/\\\//g, '/'))
      .filter(isAllowedJpcenterAssetUrl);
  });

  return [...new Set<string>(urls)].slice(0, 12);
};

const downloadRemoteAsset = (
  assetUrl: string,
  maxBytes: number,
  redirectsRemaining = 3,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    if (!isAllowedJpcenterAssetUrl(assetUrl)) {
      reject(new ApiError(httpStatus.BAD_GATEWAY, 'Invalid auction sheet URL'));
      return;
    }

    const request = https.get(
      assetUrl,
      {
        headers: {
          Accept: 'application/pdf,image/*;q=0.9,*/*;q=0.1',
          'Accept-Encoding': 'identity',
          'User-Agent': 'CarClickBD-AuctionSheet/1.0',
        },
      },
      response => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirectsRemaining <= 0) {
            reject(
              new ApiError(
                httpStatus.BAD_GATEWAY,
                'Too many auction sheet download redirects',
              ),
            );
            return;
          }

          const redirectedUrl = new URL(location, assetUrl).toString();
          downloadRemoteAsset(
            redirectedUrl,
            maxBytes,
            redirectsRemaining - 1,
          ).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(
            new ApiError(
              httpStatus.BAD_GATEWAY,
              `Auction sheet asset download failed (HTTP ${status})`,
            ),
          );
          return;
        }

        const contentLength = Number(response.headers['content-length'] || 0);
        if (contentLength > maxBytes) {
          response.resume();
          reject(
            new ApiError(
              httpStatus.BAD_GATEWAY,
              'Auction sheet asset is too large',
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            response.destroy(
              new ApiError(
                httpStatus.BAD_GATEWAY,
                'Auction sheet asset is too large',
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      },
    );

    request.setTimeout(45000, () => {
      request.destroy(new Error('Auction sheet asset request timed out'));
    });
    request.on('error', reject);
  });

const fetchRemoteAsset = async (assetUrl: string) => {
  if (!isAllowedJpcenterAssetUrl(assetUrl)) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Invalid auction sheet URL');
  }

  const maxBytes = 15 * 1024 * 1024;
  let lastError: unknown;
  let buffer = Buffer.alloc(0);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      buffer = await downloadRemoteAsset(assetUrl, maxBytes);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 750));
      }
    }
  }
  if (!buffer.length || buffer.length > maxBytes) {
    if (lastError instanceof ApiError) throw lastError;
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'JPCenter returned an invalid auction sheet image',
    );
  }
  return buffer;
};

const createPdfFromReportImages = async (imageUrls: string[]) => {
  if (!imageUrls.length) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'JPCenter returned no auction sheet images',
    );
  }

  const imageBuffers: Buffer[] = [];
  let totalBytes = 0;
  for (const imageUrl of imageUrls) {
    const imageBuffer = await fetchRemoteAsset(imageUrl);
    totalBytes += imageBuffer.length;
    if (totalBytes > 30 * 1024 * 1024) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        'Auction sheet images are too large',
      );
    }
    imageBuffers.push(imageBuffer);
  }

  const pdf = await PDFDocument.create();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 18;

  for (const imageBuffer of imageBuffers) {
    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await sharp(imageBuffer)
        .rotate()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        'JPCenter returned an unreadable auction sheet image',
      );
    }

    const embeddedImage = await pdf.embedJpg(jpegBuffer);
    const scale = Math.min(
      (pageWidth - margin * 2) / embeddedImage.width,
      (pageHeight - margin * 2) / embeddedImage.height,
    );
    const width = embeddedImage.width * scale;
    const height = embeddedImage.height * scale;
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }

  return Buffer.from(await pdf.save());
};

const getJpcenterReportPdf = async (chassis: string, recordKey: string) => {
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
  if (pdfUrl) {
    const remotePdf = await fetchRemotePdf(pdfUrl);
    return { buffer: remotePdf.buffer, pdfUrl };
  }

  const reportImageUrls = findReportImageUrls(responseBody);
  if (!reportImageUrls.length) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'JPCenter returned the report but no downloadable auction sheet was found',
    );
  }
  return { buffer: await createPdfFromReportImages(reportImageUrls) };
};

const fetchRemotePdf = async (pdfUrl: string) => {
  if (!isAllowedJpcenterPdfUrl(pdfUrl)) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Invalid auction sheet URL');
  }

  const maxBytes = 30 * 1024 * 1024;
  const buffer = await downloadRemoteAsset(pdfUrl, maxBytes);
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
    contentType: 'application/pdf',
  };
};

const persistAuctionSheetPdf = async (chassis: string, buffer: Buffer) => {
  const root = getSheetRoot();
  await fs.promises.mkdir(root, { recursive: true });

  const targetPath = path.join(root, `${normalizedFileName(chassis)}.pdf`);
  if (isValidLocalSheetFile(targetPath)) return targetPath;

  const temporaryPath = `${targetPath}.${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.tmp`;
  await fs.promises.writeFile(temporaryPath, buffer, { flag: 'wx' });

  try {
    await fs.promises.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => undefined);
    if (!isValidLocalSheetFile(targetPath)) throw error;
  }

  if (!isValidLocalSheetFile(targetPath)) {
    throw new ApiError(
      httpStatus.BAD_GATEWAY,
      'Auction sheet PDF could not be stored safely',
    );
  }
  return targetPath;
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

  try {
    await prepareAuctionSheetFile(createdOrder._id.toString());
  } catch (error) {
    await AuctionSheetOrder.findByIdAndDelete(createdOrder._id).catch(
      () => undefined,
    );
    throw error;
  }

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

const prepareAuctionSheetFile = async (id: string) => {
  const order = await getOrderById(id);
  const existingFile = findAuctionSheetFile(order.chassis);
  if (existingFile) return existingFile;

  const preparationKey = normalizedFileName(order.chassis);
  const runningPreparation = preparationByChassis.get(preparationKey);
  if (runningPreparation) return runningPreparation;

  const preparation = (async () => {
    if (!order.jpcenterRecordKey && !order.jpcenterPdfUrl) {
      const jpcenterReport = await getJpcenterReport(order.chassis);
      const recoveredKey = String(jpcenterReport?.record_key || '').trim();
      if (recoveredKey) order.jpcenterRecordKey = recoveredKey;
    }

    const savedPdfUrl = String(order.jpcenterPdfUrl || '').trim();
    let reportPdf: { buffer: Buffer; pdfUrl?: string } | undefined;
    if (savedPdfUrl) {
      const remotePdf = await fetchRemotePdf(savedPdfUrl);
      reportPdf = { buffer: remotePdf.buffer, pdfUrl: savedPdfUrl };
    } else if (order.jpcenterRecordKey) {
      reportPdf = await getJpcenterReportPdf(
        order.chassis,
        order.jpcenterRecordKey,
      );
      if (reportPdf.pdfUrl) order.jpcenterPdfUrl = reportPdf.pdfUrl;
    }

    if (!reportPdf) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Auction sheet is not available from JPCenter. Payment was not created',
      );
    }

    const filePath = await persistAuctionSheetPdf(
      order.chassis,
      reportPdf.buffer,
    );
    order.jpcenterReportFetchedAt = new Date();
    await order.save();
    return filePath;
  })();

  preparationByChassis.set(preparationKey, preparation);
  try {
    return await preparation;
  } finally {
    if (preparationByChassis.get(preparationKey) === preparation) {
      preparationByChassis.delete(preparationKey);
    }
  }
};

const updatePayment = async (params: {
  orderId?: string;
  sessionToken?: string;
  status: AuctionSheetOrderStatus;
  gatewayStatus?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!params.orderId && !params.sessionToken) return null;

  const filter: Record<string, unknown> = {};
  if (params.orderId) filter._id = params.orderId;
  if (params.sessionToken) filter.bdgateSessionToken = params.sessionToken;

  const current = await AuctionSheetOrder.findOne(filter);
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
  const paid = order.status === 'PAID';
  let sheetFile = findAuctionSheetFile(order.chassis);
  if (paid && !sheetFile) {
    try {
      sheetFile = await prepareAuctionSheetFile(id);
    } catch (error: any) {
      console.error('[auction-sheet] paid report preparation failed', {
        orderId: id,
        message: error?.message || 'Unknown error',
      });
    }
  }

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
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Auction sheet is available after payment confirmation',
    );
  }

  let filePath = findAuctionSheetFile(order.chassis);
  if (!filePath) filePath = await prepareAuctionSheetFile(id);
  if (filePath) return { filePath, chassis: order.chassis };

  throw new ApiError(
    httpStatus.NOT_FOUND,
    'Auction sheet file is not available',
  );
};

export const AuctionSheetService = {
  normalizeChassis,
  getReport,
  createOrder,
  getOrderById,
  prepareAuctionSheetFile,
  updatePayment,
  getPaymentStatus,
  getDownloadFile,
};
