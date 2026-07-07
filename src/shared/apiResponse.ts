import type { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: unknown[];
}

export function sendSuccess<T>(res: Response, statusCode: number, message: string, data: T): void {
  const body: SuccessResponse<T> = { success: true, message, data };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown[],
): void {
  const body: ErrorResponse = { success: false, message, ...(errors && { errors }) };
  res.status(statusCode).json(body);
}
