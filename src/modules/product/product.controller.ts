import * as productService from './product.service.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import type { CreateProductInput, UpdateProductInput } from './product.validation.js';

export const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(
    req.body as CreateProductInput,
    req.file,
    req.user!.userId,
  );
  sendSuccess(res, { statusCode: 201, message: 'Product created', data: product });
});

export const list = asyncHandler(async (req, res) => {
  const { data, meta } = await productService.listProducts(req.query as Record<string, unknown>);
  sendSuccess(res, { message: 'Products retrieved', data, meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const product = await productService.getProduct(req.params['id'] as string);
  sendSuccess(res, { message: 'Product retrieved', data: product });
});

export const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(
    req.params['id'] as string,
    req.body as UpdateProductInput,
    req.file,
  );
  sendSuccess(res, { message: 'Product updated', data: product });
});

export const remove = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params['id'] as string);
  res.status(204).send();
});
