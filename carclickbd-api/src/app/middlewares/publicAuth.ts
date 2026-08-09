import { NextFunction, Request, Response } from 'express';
import config from '../../config';
import { jwtHelpers } from '../../helper/jwtHelpers';

const publicAuth =
  () => async (req: Request, res: Response, next: NextFunction) => {
    try {
      //get authorization token
      const token = req.headers.authorization as string;

      let verifiedUser = null;

      if (token) {
        verifiedUser = jwtHelpers.verifyToken(
          token,
          config.jwt.accessTokenSecret as string,
        );
      }

      if (verifiedUser) {
        req.user = verifiedUser;
      } else {
        req.user = null;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export default publicAuth;
