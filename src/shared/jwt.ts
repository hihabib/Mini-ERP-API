import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  roleId: string;
}

function sign(payload: TokenPayload, secret: string, expiresIn: SignOptions['expiresIn']): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signAccessToken(payload: TokenPayload): string {
  // env.JWT_ACCESS_EXPIRES_IN is a validated string like "15m"
  return sign(
    payload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  );
}

export function signRefreshToken(payload: TokenPayload): string {
  return sign(
    payload,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  );
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as TokenPayload;
}
