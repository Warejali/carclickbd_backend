import mongoose from 'mongoose';
import { IErrorMessages } from '../inerfaces/error';
import { IErrorResponse } from '../inerfaces/common';

const handleValidationError = (
  error: mongoose.Error.ValidationError,
): IErrorResponse => {
  const errors: IErrorMessages[] = Object.values(error.errors).map(
    (singleError: mongoose.Error.ValidatorError | mongoose.Error.CastError) => {
      return {
        path: singleError?.path,
        message: singleError?.message,
      };
    },
  );

  const statusCode = 400;
  return {
    statusCode,
    message: 'Validation Error',
    errorMessages: errors,
  };
};

export default handleValidationError;
