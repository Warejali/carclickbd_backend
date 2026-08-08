import { NextFunction, Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const catchAsync = (fn: RequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

export default catchAsync;
