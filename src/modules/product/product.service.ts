import { Product } from './product.model.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../shared/ApiError.js';
import { QueryBuilder } from '../../shared/queryBuilder/QueryBuilder.js';
import { localStorageAdapter as storage } from '../../shared/storage/local.storage.js';
import type { CreateProductInput, UpdateProductInput } from './product.validation.js';

export async function createProduct(
  data: CreateProductInput,
  file: Express.Multer.File | undefined,
  userId: string,
) {
  if (!file) {
    throw new BadRequestError('Product image is required');
  }

  const existing = await Product.findOne({ sku: data.sku });
  if (existing) {
    await storage.deleteImage(`/uploads/${file.filename}`);
    throw new ConflictError(`SKU '${data.sku}' already exists`);
  }

  const imageUrl = await storage.saveImage(file);
  return Product.create({ ...data, imageUrl, createdBy: userId });
}

export async function listProducts(queryParams: Record<string, unknown>) {
  const builder = new QueryBuilder(Product.find(), queryParams)
    .search(['name', 'sku'])
    .filter(['search', 'sort', 'page', 'limit'])
    .sort()
    .paginate();

  const [data, total] = await Promise.all([builder.execute(), builder.countTotal()]);
  const page = Math.max(1, Number(queryParams['page']) || 1);
  const limit = Math.min(100, Math.max(1, Number(queryParams['limit']) || 10));

  return { data, meta: { page, limit, total } };
}

export async function getProduct(id: string) {
  const product = await Product.findById(id);
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function updateProduct(
  id: string,
  data: UpdateProductInput,
  file: Express.Multer.File | undefined,
) {
  const product = await Product.findById(id);
  if (!product) {
    if (file) await storage.deleteImage(`/uploads/${file.filename}`);
    throw new NotFoundError('Product not found');
  }

  if (data.sku && data.sku !== product.sku) {
    const existing = await Product.findOne({ sku: data.sku });
    if (existing) {
      if (file) await storage.deleteImage(`/uploads/${file.filename}`);
      throw new ConflictError(`SKU '${data.sku}' already exists`);
    }
  }

  let imageUrl = product.imageUrl;
  if (file) {
    const oldUrl = product.imageUrl;
    imageUrl = await storage.saveImage(file);
    await storage.deleteImage(oldUrl);
  }

  // Strip undefined so partial updates don't overwrite existing fields with undefined
  const payload = Object.fromEntries(
    Object.entries({ ...data, imageUrl }).filter(([, v]) => v !== undefined),
  );

  const updated = await Product.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });
  return updated!;
}

export async function deleteProduct(id: string) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new NotFoundError('Product not found');
  await storage.deleteImage(product.imageUrl);
}
