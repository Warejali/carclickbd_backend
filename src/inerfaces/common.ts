import { IErrorMessages } from './error';

export type IErrorResponse = {
  statusCode: number;
  message: string;
  errorMessages: IErrorMessages[];
};
