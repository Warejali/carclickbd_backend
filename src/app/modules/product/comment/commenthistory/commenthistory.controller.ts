import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../../../shared/catchAsync';
import { Request, Response } from 'express';
import sendResponse from '../../../../../shared/sendResponse';
import { ICommentHistory } from './commenthistory.interface';
import httpStatus from 'http-status';
import { CommentHistoryService } from './commenthistory.service';

const getCommentHistories = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;

  const result = await CommentHistoryService.getMyCommentHistory(userId);

  sendResponse<ICommentHistory[]>(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment histories Fetched successfully!',
    data: result,
  });
});

export const commentHistoriesController = { getCommentHistories };
