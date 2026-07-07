import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import { ApiError } from '../../shared/ApiError.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT_REFRESH_EXPIRES_IN default of 7d

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
  };
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { accessToken, refreshToken, user } = await authService.login(email, password);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE_MS));
    sendSuccess(res, 200, 'Login successful', { accessToken, user });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies[REFRESH_COOKIE] as string | undefined;

    if (!token) {
      throw new ApiError(401, 'Refresh token missing');
    }

    const { accessToken } = await authService.refreshTokens(token);
    sendSuccess(res, 200, 'Token refreshed', { accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.clearCookie(REFRESH_COOKIE, cookieOptions(0));
    sendSuccess(res, 200, 'Logged out successfully', {});
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // authenticate middleware guarantees req.user is set before this handler runs
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, 200, 'User retrieved', user);
  } catch (err) {
    next(err);
  }
}
