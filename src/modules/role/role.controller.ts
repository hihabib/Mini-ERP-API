import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import { Role } from './role.model.js';

export const getRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await Role.find()
    .select('name permissions isSystemRole')
    .populate('permissions', 'key module description');
  sendSuccess(res, {
    message: 'Roles retrieved successfully',
    data: roles,
  });
});
