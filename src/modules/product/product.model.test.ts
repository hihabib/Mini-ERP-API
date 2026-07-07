import { describe, it, expect, beforeAll } from 'vitest';
import { Types } from 'mongoose';
import { Product } from './product.model.js';

beforeAll(async () => {
  await Product.createIndexes();
});

const userId = new Types.ObjectId();
const baseProduct = (sku = `SKU-${Date.now()}-${Math.random()}`) => ({
  name: 'Widget A',
  sku,
  category: 'Electronics',
  purchasePrice: 20,
  sellingPrice: 35,
  imageUrl: 'https://example.com/widget.png',
  createdBy: userId,
});

describe('Product model', () => {
  it('creates a product with all required fields', async () => {
    const product = await Product.create(baseProduct());
    expect(product.name).toBe('Widget A');
    expect(product.stockQuantity).toBe(0);
    expect(product._id).toBeDefined();
  });

  it('defaults stockQuantity to 0', async () => {
    const product = await Product.create(baseProduct());
    expect(product.stockQuantity).toBe(0);
  });

  it('fails when name is missing', async () => {
    const { name: _n, ...data } = baseProduct();
    await expect(Product.create(data)).rejects.toThrow(/name/i);
  });

  it('fails when sku is missing', async () => {
    const { sku: _s, ...data } = baseProduct();
    await expect(Product.create(data)).rejects.toThrow(/sku/i);
  });

  it('fails when category is missing', async () => {
    const { category: _c, ...data } = baseProduct();
    await expect(Product.create(data)).rejects.toThrow(/category/i);
  });

  it('fails when purchasePrice is missing', async () => {
    const { purchasePrice: _p, ...data } = baseProduct();
    await expect(Product.create(data)).rejects.toThrow(/purchasePrice/i);
  });

  it('fails when sellingPrice is missing', async () => {
    const { sellingPrice: _s, ...data } = baseProduct();
    await expect(Product.create(data)).rejects.toThrow(/sellingPrice/i);
  });

  it('fails when imageUrl is missing', async () => {
    const { imageUrl: _i, ...data } = baseProduct();
    await expect(Product.create(data)).rejects.toThrow(/imageUrl/i);
  });

  it('enforces unique SKU constraint', async () => {
    const sku = 'FIXED-SKU-001';
    await Product.create(baseProduct(sku));
    await expect(Product.create(baseProduct(sku))).rejects.toThrow(/duplicate key|E11000/i);
  });

  it('rejects purchasePrice below 0', async () => {
    await expect(Product.create({ ...baseProduct(), purchasePrice: -1 })).rejects.toThrow();
  });

  it('rejects stockQuantity below 0', async () => {
    await expect(Product.create({ ...baseProduct(), stockQuantity: -5 })).rejects.toThrow();
  });
});
