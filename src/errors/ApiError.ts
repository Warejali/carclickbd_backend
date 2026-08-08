/**
 * Title: 'Making node built in error customizeable'
 * Description: ''
 * Author: 'Masum Rana'
 * Date: 27-12-2023
 *
 */

class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string | undefined, stack = '') {
    super(message);
    this.statusCode = statusCode;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
