import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fsPromises from 'fs/promises';
import { Permission } from '../role/permission.model.js';
import { Role } from '../role/role.model.js';
import { User } from '../user/user.model.js';
import { Product } from './product.model.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import authRouter from '../auth/auth.routes.js';
import productRouter from './product.routes.js';
import { env } from '../../config/env.js';

// Minimal 1×1 transparent PNG — used as a test image for multipart uploads
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const UPLOAD_PATH = path.resolve(env.UPLOAD_DIR);

const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.use('/api/products', productRouter);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

async function loginAs(email: string): Promise<string> {
  const res = await request.post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken as string;
}

const ALL_PRODUCT_PERMS = ['product:create', 'product:view', 'product:update', 'product:delete'];

describe('Product module', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    await Promise.all([
      Permission.createIndexes(),
      Role.createIndexes(),
      User.createIndexes(),
      Product.createIndexes(),
    ]);
    await fsPromises.mkdir(UPLOAD_PATH, { recursive: true });
  });

  beforeEach(async () => {
    // Global afterEach in tests/setup.ts wipes all collections — recreate fixtures here.
    const permDocs = await Permission.insertMany(
      ALL_PRODUCT_PERMS.map((key) => ({ key, module: 'product', description: '' })),
    );
    const [createPerm, viewPerm, updatePerm, deletePerm] = permDocs;

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [createPerm._id, viewPerm._id, updatePerm._id, deletePerm._id],
      isSystemRole: true,
    });
    const viewerRole = await Role.create({
      name: 'Viewer',
      permissions: [viewPerm._id],
      isSystemRole: false,
    });

    await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Test@1234',
      role: adminRole._id,
    });
    await User.create({
      name: 'Viewer User',
      email: 'viewer@test.com',
      password: 'Test@1234',
      role: viewerRole._id,
    });

    adminToken = await loginAs('admin@test.com');
    viewerToken = await loginAs('viewer@test.com');
  });

  afterEach(async () => {
    // Clean up any image files written during tests
    const files = await fsPromises.readdir(UPLOAD_PATH).catch(() => []);
    await Promise.all(
      files.map((f) => fsPromises.unlink(path.join(UPLOAD_PATH, f)).catch(() => {})),
    );
  });

  // ── POST /api/products ────────────────────────────────────────────────────────

  describe('POST /api/products', () => {
    it('returns 400 when image is missing', async () => {
      const res = await request
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Widget X')
        .field('sku', 'WGT-X')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('image');
    });

    it('creates a product and returns 201 with a resolvable imageUrl', async () => {
      const res = await request
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TEST_PNG, { filename: 'test.png', contentType: 'image/png' })
        .field('name', 'Widget X')
        .field('sku', 'WGT-X')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(201);
      expect(res.body.data.sku).toBe('WGT-X');
      expect(res.body.data.imageUrl).toMatch(/^\/uploads\//);
    });

    it('returns 409 for a duplicate SKU', async () => {
      await request
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TEST_PNG, { filename: 'a.png', contentType: 'image/png' })
        .field('name', 'Widget A')
        .field('sku', 'DUP-SKU')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      const res = await request
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TEST_PNG, { filename: 'b.png', contentType: 'image/png' })
        .field('name', 'Widget B')
        .field('sku', 'DUP-SKU')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(409);
    });

    it('returns 403 when user lacks product:create permission', async () => {
      const res = await request
        .post('/api/products')
        .set('Authorization', `Bearer ${viewerToken}`)
        .attach('image', TEST_PNG, { filename: 'test.png', contentType: 'image/png' })
        .field('name', 'Widget X')
        .field('sku', 'WGT-X')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(403);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request
        .post('/api/products')
        .field('name', 'Widget X')
        .field('sku', 'WGT-X')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(401);
    });

    it('returns 400 when image exceeds the maximum upload size', async () => {
      // 6 MB exceeds the 5 MB default limit — triggers the LIMIT_FILE_SIZE multer error
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 0);

      const res = await request
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', oversizedBuffer, { filename: 'big.png', contentType: 'image/png' })
        .field('name', 'Big Widget')
        .field('sku', 'BIG-001')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/too large|max/i);
    });

    it('returns 400 when image type is not jpeg/png/webp', async () => {
      const res = await request
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', Buffer.from('not an image'), {
          filename: 'file.txt',
          contentType: 'text/plain',
        })
        .field('name', 'Widget X')
        .field('sku', 'INV-TYPE')
        .field('category', 'tools')
        .field('purchasePrice', '10')
        .field('sellingPrice', '20');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/jpeg|png|webp/i);
    });
  });

  // ── GET /api/products ─────────────────────────────────────────────────────────

  describe('GET /api/products', () => {
    beforeEach(async () => {
      await Product.insertMany([
        {
          name: 'Widget Alpha',
          sku: 'WGT-001',
          category: 'electronics',
          purchasePrice: 10,
          sellingPrice: 20,
          imageUrl: '/uploads/dummy1.png',
        },
        {
          name: 'Widget Beta',
          sku: 'WGT-002',
          category: 'electronics',
          purchasePrice: 10,
          sellingPrice: 20,
          imageUrl: '/uploads/dummy2.png',
        },
        {
          name: 'Gadget Pro',
          sku: 'GDG-001',
          category: 'toys',
          purchasePrice: 20,
          sellingPrice: 40,
          imageUrl: '/uploads/dummy3.png',
        },
        {
          name: 'Gadget Lite',
          sku: 'GDG-002',
          category: 'toys',
          purchasePrice: 5,
          sellingPrice: 10,
          imageUrl: '/uploads/dummy4.png',
        },
        {
          name: 'Super Tool',
          sku: 'TL-001',
          category: 'tools',
          purchasePrice: 50,
          sellingPrice: 90,
          imageUrl: '/uploads/dummy5.png',
        },
      ]);
    });

    it('returns a paginated list with meta', async () => {
      const res = await request.get('/api/products').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 5 });
    });

    it('filters by search — partial match on name', async () => {
      const res = await request
        .get('/api/products?search=widget')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      (res.body.data as Array<{ name: string }>).forEach((p) =>
        expect(p.name.toLowerCase()).toContain('widget'),
      );
    });

    it('filters by category — exact match', async () => {
      const res = await request
        .get('/api/products?category=toys')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      (res.body.data as Array<{ category: string }>).forEach((p) =>
        expect(p.category).toBe('toys'),
      );
    });

    it('paginates correctly and reports accurate meta.total', async () => {
      const res = await request
        .get('/api/products?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 5 });
    });

    it('returns 403 when user has no product:view permission', async () => {
      const noPermRole = await Role.create({
        name: 'NoPerms',
        permissions: [],
        isSystemRole: false,
      });
      await User.create({
        name: 'No Perm',
        email: 'noperm@test.com',
        password: 'Test@1234',
        role: noPermRole._id,
      });
      const noPermToken = await loginAs('noperm@test.com');

      const res = await request.get('/api/products').set('Authorization', `Bearer ${noPermToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/products/:id ─────────────────────────────────────────────────────

  describe('GET /api/products/:id', () => {
    it('returns the product by ID', async () => {
      const product = await Product.create({
        name: 'Single Product',
        sku: 'SP-001',
        category: 'test',
        purchasePrice: 10,
        sellingPrice: 20,
        imageUrl: '/uploads/sp.png',
      });

      const res = await request
        .get(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sku).toBe('SP-001');
    });

    it('returns 404 for an unknown ID', async () => {
      const res = await request
        .get('/api/products/000000000000000000000001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/products/:id ───────────────────────────────────────────────────

  describe('PATCH /api/products/:id', () => {
    it('updates name without replacing image', async () => {
      const product = await Product.create({
        name: 'Old Name',
        sku: 'OL-001',
        category: 'test',
        purchasePrice: 10,
        sellingPrice: 20,
        imageUrl: '/uploads/old.png',
      });

      const res = await request
        .patch(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'New Name');

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.imageUrl).toBe('/uploads/old.png');
    });

    it('replaces imageUrl and deletes old file when a new image is provided', async () => {
      const oldFilename = `old-${Date.now()}.png`;
      const oldFilePath = path.join(UPLOAD_PATH, oldFilename);
      await fsPromises.writeFile(oldFilePath, TEST_PNG);

      const product = await Product.create({
        name: 'Has Image',
        sku: 'HI-001',
        category: 'test',
        purchasePrice: 10,
        sellingPrice: 20,
        imageUrl: `/uploads/${oldFilename}`,
      });

      const res = await request
        .patch(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TEST_PNG, { filename: 'new.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).not.toBe(`/uploads/${oldFilename}`);
      expect(res.body.data.imageUrl).toMatch(/^\/uploads\//);

      // Old file should have been deleted
      await expect(fsPromises.access(oldFilePath)).rejects.toThrow();
    });

    it('returns 404 when product does not exist and cleans up the uploaded file', async () => {
      const nonExistentId = '000000000000000000000001';

      const res = await request
        .patch(`/api/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', TEST_PNG, { filename: 'orphan.png', contentType: 'image/png' });

      expect(res.status).toBe(404);

      // No stray file should remain in UPLOAD_PATH
      const files = await fsPromises.readdir(UPLOAD_PATH).catch(() => []);
      expect(files).toHaveLength(0);
    });

    it('returns 409 when updating to a SKU that belongs to another product', async () => {
      const existing = await Product.create({
        name: 'Existing',
        sku: 'TAKEN-SKU',
        category: 'test',
        purchasePrice: 5,
        sellingPrice: 10,
        imageUrl: '/uploads/e.png',
      });
      const target = await Product.create({
        name: 'Target',
        sku: 'TARGET-SKU',
        category: 'test',
        purchasePrice: 5,
        sellingPrice: 10,
        imageUrl: '/uploads/t.png',
      });

      // Try to change target's SKU to the one owned by existing
      const res = await request
        .patch(`/api/products/${target._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('sku', existing.sku);

      expect(res.status).toBe(409);
    });

    it('returns 403 when user lacks product:update permission', async () => {
      const product = await Product.create({
        name: 'Protected',
        sku: 'PROT-001',
        category: 'test',
        purchasePrice: 10,
        sellingPrice: 20,
        imageUrl: '/uploads/p.png',
      });

      const res = await request
        .patch(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .field('name', 'Hack');

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/products/:id ──────────────────────────────────────────────────

  describe('DELETE /api/products/:id', () => {
    it('returns 204 and a subsequent GET returns 404', async () => {
      const product = await Product.create({
        name: 'To Delete',
        sku: 'DEL-001',
        category: 'test',
        purchasePrice: 10,
        sellingPrice: 20,
        imageUrl: '/uploads/del.png',
      });

      const deleteRes = await request
        .delete(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(204);

      const getRes = await request
        .get(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(404);
    });

    it('returns 404 for a non-existent product', async () => {
      const res = await request
        .delete('/api/products/000000000000000000000001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 403 when user lacks product:delete permission', async () => {
      const product = await Product.create({
        name: 'Protected',
        sku: 'DPROT-001',
        category: 'test',
        purchasePrice: 10,
        sellingPrice: 20,
        imageUrl: '/uploads/dp.png',
      });

      const res = await request
        .delete(`/api/products/${product._id.toString()}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
