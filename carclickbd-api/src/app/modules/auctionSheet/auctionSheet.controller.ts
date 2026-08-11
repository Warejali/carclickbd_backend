import { Request, Response } from 'express';
import httpStatus from 'http-status';
import path from 'path';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { AuctionSheetService } from './auctionSheet.service';

const getReport = catchAsync(async (req: Request, res: Response) => {
  const result = await AuctionSheetService.getReport(req.query.chassis);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Auction sheet report fetched successfully',
    data: result,
  });
});

const createOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await AuctionSheetService.createOrder(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Auction sheet order created successfully',
    data: { order: result },
  });
});

const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const forwardedProtocol = req.headers['x-forwarded-proto'] as
    | string
    | undefined;
  const protocol = forwardedProtocol?.split(',')[0] || req.protocol;
  const backendUrl = `${protocol}://${req.get('host')}`;
  const result = await AuctionSheetService.getPaymentStatus(
    req.params.id,
    backendUrl,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Auction sheet payment status fetched successfully',
    data: result,
  });
});

const download = catchAsync(async (req: Request, res: Response) => {
  const file = await AuctionSheetService.getDownloadFile(req.params.id);

  if ('buffer' in file) {
    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="auction-sheet-${file.chassis}.pdf"`,
    );
    res.setHeader('Content-Length', file.buffer.length);
    res.send(file.buffer);
    return;
  }

  const extension = path.extname(file.filePath) || '.pdf';
  res.download(
    file.filePath,
    `auction-sheet-${file.chassis}${extension}`,
    error => {
      if (error && !res.headersSent) {
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Could not download auction sheet',
        });
      }
    },
  );
});

export const AuctionSheetController = {
  getReport,
  createOrder,
  getPaymentStatus,
  download,
};
