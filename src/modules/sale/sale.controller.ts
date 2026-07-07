import * as saleService from './sale.service.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import type { CreateSaleInput } from './sale.validation.js';

export const create = asyncHandler(async (req, res) => {
  const sale = await saleService.createSale(req.body as CreateSaleInput, req.user!.userId);
  sendSuccess(res, { statusCode: 201, message: 'Sale created', data: sale });
});

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await saleService.listSales(req.query as Record<string, unknown>);
  sendSuccess(res, { message: 'Sales retrieved', data, meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const sale = await saleService.getSale(req.params['id'] as string);
  sendSuccess(res, { message: 'Sale retrieved', data: sale });
});
