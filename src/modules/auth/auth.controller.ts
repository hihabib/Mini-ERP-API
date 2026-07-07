import * as authService from './auth.service.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import { ApiError } from '../../shared/ApiError.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
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

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const { accessToken, refreshToken, user } = await authService.login(email, password);

  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE_MS));
  sendSuccess(res, { message: 'Login successful', data: { accessToken, user } });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE] as string | undefined;

  if (!token) {
    throw new ApiError(401, 'Refresh token missing');
  }

  const { accessToken } = await authService.refreshTokens(token);
  sendSuccess(res, { message: 'Token refreshed', data: { accessToken } });
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions(0));
  sendSuccess(res, { message: 'Logged out successfully', data: {} });
});

export const me = asyncHandler(async (req, res) => {
  // authenticate middleware guarantees req.user is set before this handler runs
  const user = await authService.getMe(req.user!.userId);
  sendSuccess(res, { message: 'User retrieved', data: user });
});
