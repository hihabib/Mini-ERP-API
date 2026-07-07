import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../shared/jwt.js';
import { ApiError } from '../shared/ApiError.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, roleId: payload.roleId };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired access token'));
  }
}
