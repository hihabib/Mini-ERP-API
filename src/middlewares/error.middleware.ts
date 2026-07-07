import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError, BadRequestError, ConflictError } from '../shared/ApiError.js';
import { env } from '../config/env.js';

function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  errors?: Record<string, string>,
): void {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && Object.keys(errors).length > 0 && { errors }),
  });
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Always log server-side so unexpected errors are never silently swallowed
  console.error(err);

  // Known application error
  if (err instanceof ApiError) {
    sendErrorResponse(res, err.statusCode, err.message, err.errors);
    return;
  }

  // Mongoose document validation error (required field missing, enum mismatch, etc.)
  if (err instanceof mongoose.Error.ValidationError) {
    const errors: Record<string, string> = {};
    for (const [field, ve] of Object.entries(err.errors)) {
      errors[field] = ve.message;
    }
    const wrapped = new BadRequestError('Validation failed', errors);
    sendErrorResponse(res, wrapped.statusCode, wrapped.message, wrapped.errors);
    return;
  }

  // MongoDB duplicate-key error (E11000)
  const mongoErr = err as { code?: number; keyValue?: Record<string, unknown> };
  if (mongoErr.code === 11000) {
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? 'field';
    const wrapped = new ConflictError(`Duplicate value: '${field}' already exists`);
    sendErrorResponse(res, wrapped.statusCode, wrapped.message);
    return;
  }

  // Unknown — never expose internals in production
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : String(err);
  sendErrorResponse(res, 500, message);
}
