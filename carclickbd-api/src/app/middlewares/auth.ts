/**
 * Title: 'authentication middlewares'
 * Description: ''
 * Author: 'Masum Rana'
 * Date: 31-12-2023
 *
 */

import { NextFunction, Request, Response } from 'express';
import ApiError from '../../errors/ApiError';
import { jwtHelpers } from '../../helper/jwtHelpers';
import httpStatus from 'http-status';
import config from '../../config';

const auth =
  (...requiredRoles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      //get authorization token
      const authorization = req.headers.authorization;
      const token = authorization?.startsWith('Bearer ')
        ? authorization.split(' ')[1]
        : authorization;
      // console.log(token);

      if (!token || token === 'undefined' || token === 'null') {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
      }
      // verify token
      let verifiedUser = null;

      verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt.accessTokenSecret as string,
      );

      req.user = verifiedUser; // role userId

      // By role for guarding
      if (requiredRoles.length && !requiredRoles.includes(verifiedUser.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export default auth;
