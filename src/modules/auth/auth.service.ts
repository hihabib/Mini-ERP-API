import bcrypt from 'bcrypt';
import type { Types } from 'mongoose';
import { User } from '../user/user.model.js';
import type { IRole } from '../role/role.model.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../../shared/jwt.js';
import { ApiError } from '../../shared/ApiError.js';

type PopulatedRole = IRole & { _id: Types.ObjectId };

export async function login(email: string, password: string) {
  const user = await User.findOne({ email, isActive: true }).populate({
    path: 'role',
    populate: { path: 'permissions' },
  });

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const role = user.role as unknown as PopulatedRole;

  const payload: TokenPayload = {
    userId: user._id.toString(),
    roleId: role._id.toString(),
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
    user,
  };
}

export async function refreshTokens(token: string) {
  let payload: TokenPayload;

  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  return { accessToken: signAccessToken({ userId: payload.userId, roleId: payload.roleId }) };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId).populate({
    path: 'role',
    populate: { path: 'permissions' },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'User not found or inactive');
  }

  return user;
}
