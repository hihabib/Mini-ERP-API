import * as dashboardService from './dashboard.service.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import { asyncHandler } from '../../shared/asyncHandler.js';

export const getStats = asyncHandler(async (_req, res) => {
  const data = await dashboardService.getDashboardStats();
  sendSuccess(res, { message: 'Dashboard stats retrieved', data });
});
