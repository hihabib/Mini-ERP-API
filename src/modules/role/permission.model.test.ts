import { describe, it, expect, beforeAll } from 'vitest';
import { Permission } from './permission.model.js';

beforeAll(async () => {
  await Permission.createIndexes();
});

describe('Permission model', () => {
  it('creates a permission with all required fields', async () => {
    const perm = await Permission.create({
      key: 'product:create',
      description: 'Create a new product',
      module: 'product',
    });
    expect(perm.key).toBe('product:create');
    expect(perm.module).toBe('product');
    expect(perm._id).toBeDefined();
  });

  it('fails when key is missing', async () => {
    await expect(
      Permission.create({ description: 'Missing key', module: 'product' }),
    ).rejects.toThrow(/key/i);
  });

  it('fails when module is missing', async () => {
    await expect(
      Permission.create({ key: 'product:delete', description: 'No module' }),
    ).rejects.toThrow(/module/i);
  });

  it('enforces unique key constraint', async () => {
    await Permission.create({ key: 'sale:create', module: 'sale' });
    await expect(Permission.create({ key: 'sale:create', module: 'sale' })).rejects.toThrow(
      /duplicate key|E11000/i,
    );
  });

  it('defaults description to empty string', async () => {
    const perm = await Permission.create({ key: 'dashboard:view', module: 'dashboard' });
    expect(perm.description).toBe('');
  });
});
