import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import * as userService from './user.service.js';

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  sendSuccess(res, {
    statusCode: 201,
    message: 'User created successfully',
    data: user,
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.params.id as string, req.body, req.user!.userId);
  sendSuccess(res, {
    message: 'User updated successfully',
    data: user,
  });
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { users, total } = await userService.getUsers(req.query);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  sendSuccess(res, {
    message: 'Users retrieved successfully',
    data: users,
    meta: { page, limit, total },
  });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUser(req.params.id as string);
  sendSuccess(res, {
    message: 'User retrieved successfully',
    data: user,
  });
});
