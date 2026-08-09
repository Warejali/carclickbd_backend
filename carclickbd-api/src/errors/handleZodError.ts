/**
 * Title: 'handling zod error'
 * Description: ''
 * Author: 'Masum Rana'
 * Date: 27-12-2023
 *
 */

import { ZodError, ZodIssue } from 'zod';
import { IErrorMessages } from '../inerfaces/error';

const handleZodError = (error: ZodError) => {
  const errors: IErrorMessages[] = error.issues.map((issue: ZodIssue) => {
    return {
      path: issue?.path[1] as string,
      message: issue?.message,
    };
  });

  const statusCode = 400;
  return {
    statusCode,
    message: 'Validation Error',
    errorMessages: errors,
  };
};

export default handleZodError;
