import type { Response } from 'express';

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
}

interface SuccessOptions<T> {
  statusCode?: number;
  message: string;
  data: T;
  meta?: Meta;
}

export const sendSuccess = <T>(res: Response, options: SuccessOptions<T>): void => {
  const { statusCode = 200, message, data, meta } = options;
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta !== undefined && { meta }),
  });
};
