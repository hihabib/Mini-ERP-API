import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../shared/ApiError.js';
import { sendError } from '../shared/apiResponse.js';

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message, err.errors.length ? err.errors : undefined);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 422, 'Validation failed', err.issues);
    return;
  }

  console.error(err);
  sendError(res, 500, 'Internal server error');
}
