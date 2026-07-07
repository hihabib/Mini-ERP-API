import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Permission } from '../role/permission.model.js';
import { Role } from '../role/role.model.js';
import { User } from '../user/user.model.js';
import { Product } from '../product/product.model.js';
import { Sale } from './sale.model.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import authRouter from '../auth/auth.routes.js';
import saleRouter from './sale.routes.js';

// Mock the socket module so tests never need a real Socket.io server.
vi.mock('../../config/socket.js', () => ({
  emitStockUpdated: vi.fn(),
  emitSaleCreated: vi.fn(),
  initSocket: vi.fn(),
  getIO: vi.fn(),
}));

// Import AFTER vi.mock so Vitest hands us the mocked versions.
import { emitStockUpdated, emitSaleCreated } from '../../config/socket.js';

const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.use('/api/sales', saleRouter);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

async function loginAs(email: string): Promise<string> {
  const res = await request.post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken as string;
}

const ALL_SALE_PERMS = ['sale:create', 'sale:view'];

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Widget',
    sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category: 'tools',
    purchasePrice: 5,
    sellingPrice: 10,
    stockQuantity: 20,
    imageUrl: '/uploads/test.png',
    ...overrides,
  };
}

describe('Sale module', () => {
  let adminToken: string;
  let employeeToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    await Promise.all([
      Permission.createIndexes(),
      Role.createIndexes(),
      User.createIndexes(),
      Product.createIndexes(),
      Sale.createIndexes(),
    ]);
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const permDocs = await Permission.insertMany(
      ALL_SALE_PERMS.map((key) => ({ key, module: 'sale', description: '' })),
    );
    const [createPerm, viewPerm] = permDocs;

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [createPerm._id, viewPerm._id],
      isSystemRole: true,
    });
    const employeeRole = await Role.create({
      name: 'Employee',
      permissions: [createPerm._id],
      isSystemRole: false,
    });
    const viewerRole = await Role.create({
      name: 'Viewer',
      permissions: [],
      isSystemRole: false,
    });

    await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: 'Test@1234',
      role: adminRole._id,
    });
    await User.create({
      name: 'Employee',
      email: 'employee@test.com',
      password: 'Test@1234',
      role: employeeRole._id,
    });
    await User.create({
      name: 'Viewer',
      email: 'viewer@test.com',
      password: 'Test@1234',
      role: viewerRole._id,
    });

    [adminToken, employeeToken, viewerToken] = await Promise.all([
      loginAs('admin@test.com'),
      loginAs('employee@test.com'),
      loginAs('viewer@test.com'),
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/sales ───────────────────────────────────────────────────────────

  describe('POST /api/sales', () => {
    it('creates a sale, returns 201 with correct grandTotal, and decrements stock', async () => {
      const p1 = await Product.create(makeProduct({ sellingPrice: 10, stockQuantity: 50 }));
      const p2 = await Product.create(makeProduct({ sellingPrice: 25, stockQuantity: 30 }));

      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            { product: p1._id.toString(), quantity: 3 },
            { product: p2._id.toString(), quantity: 2 },
          ],
        });

      expect(res.status).toBe(201);
      // grandTotal = 3×10 + 2×25 = 80
      expect(res.body.data.grandTotal).toBe(80);
      expect(res.body.data.items).toHaveLength(2);

      const [fresh1, fresh2] = await Promise.all([
        Product.findById(p1._id),
        Product.findById(p2._id),
      ]);
      expect(fresh1!.stockQuantity).toBe(47);
      expect(fresh2!.stockQuantity).toBe(28);
    });

    it('stores price snapshots at the time of sale, not future prices', async () => {
      const p = await Product.create(makeProduct({ sellingPrice: 15, stockQuantity: 10 }));

      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ product: p._id.toString(), quantity: 1 }] });

      expect(res.status).toBe(201);
      expect(res.body.data.items[0].unitPriceSnapshot).toBe(15);
      expect(res.body.data.items[0].productNameSnapshot).toBe(p.name);
      expect(res.body.data.items[0].subtotal).toBe(15);
    });

    it('fails with 400 and does not decrement any stock when one item is insufficient', async () => {
      const sufficient = await Product.create(makeProduct({ stockQuantity: 10 }));
      const insufficient = await Product.create(makeProduct({ stockQuantity: 1 }));

      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            { product: sufficient._id.toString(), quantity: 5 }, // OK
            { product: insufficient._id.toString(), quantity: 5 }, // fails
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient/i);

      // Transaction must have rolled back — neither product changes.
      const [freshA, freshB] = await Promise.all([
        Product.findById(sufficient._id),
        Product.findById(insufficient._id),
      ]);
      expect(freshA!.stockQuantity).toBe(10);
      expect(freshB!.stockQuantity).toBe(1);
    });

    it('fails with 404 naming the bad ID when a product does not exist', async () => {
      const nonExistentId = '000000000000000000000099';

      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ product: nonExistentId, quantity: 1 }] });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain(nonExistentId);
    });

    it('emits stock:updated and sale:created with correct payload after success', async () => {
      const p = await Product.create(makeProduct({ sellingPrice: 20, stockQuantity: 10 }));

      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ product: p._id.toString(), quantity: 3 }] });

      expect(res.status).toBe(201);

      expect(emitStockUpdated).toHaveBeenCalledOnce();
      expect(emitStockUpdated).toHaveBeenCalledWith([{ productId: p._id.toString(), newStock: 7 }]);

      expect(emitSaleCreated).toHaveBeenCalledOnce();
      expect(emitSaleCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          grandTotal: 60,
          itemCount: 1,
          saleId: expect.any(String),
          createdAt: expect.any(Date),
        }),
      );
    });

    it('does NOT emit socket events when the sale fails', async () => {
      const p = await Product.create(makeProduct({ stockQuantity: 0 }));

      await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ product: p._id.toString(), quantity: 1 }] });

      expect(emitStockUpdated).not.toHaveBeenCalled();
      expect(emitSaleCreated).not.toHaveBeenCalled();
    });

    it('concurrency: two simultaneous sales for the last unit — stock never goes negative', async () => {
      const p = await Product.create(makeProduct({ stockQuantity: 1, sellingPrice: 10 }));

      const fire = () =>
        request
          .post('/api/sales')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ items: [{ product: p._id.toString(), quantity: 1 }] });

      const [r1, r2] = await Promise.allSettled([fire(), fire()]);

      const statuses = [r1, r2].map((r) => (r.status === 'fulfilled' ? r.value.status : 500));
      const successes = statuses.filter((s) => s === 201).length;
      const failures = statuses.filter((s) => s === 400).length;

      // At most one sale can succeed; at least one must fail gracefully.
      expect(successes).toBeLessThanOrEqual(1);
      expect(successes + failures).toBe(2);

      const fresh = await Product.findById(p._id);
      expect(fresh!.stockQuantity).toBeGreaterThanOrEqual(0);
    });

    it('returns 400 for an empty items array', async () => {
      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('returns 400 for quantity 0', async () => {
      const p = await Product.create(makeProduct());
      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ product: p._id.toString(), quantity: 0 }] });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid (non-ObjectId) product ID', async () => {
      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ product: 'not-an-id', quantity: 1 }] });

      expect(res.status).toBe(400);
    });

    it('employee with sale:create can create a sale', async () => {
      const p = await Product.create(makeProduct());
      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ items: [{ product: p._id.toString(), quantity: 1 }] });

      expect(res.status).toBe(201);
    });

    it('returns 403 when user lacks sale:create permission', async () => {
      const p = await Product.create(makeProduct());
      const res = await request
        .post('/api/sales')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ items: [{ product: p._id.toString(), quantity: 1 }] });

      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request
        .post('/api/sales')
        .send({ items: [{ product: '000000000000000000000001', quantity: 1 }] });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/sales ────────────────────────────────────────────────────────────

  describe('GET /api/sales', () => {
    beforeEach(async () => {
      const adminUser = await User.findOne({ email: 'admin@test.com' });
      await Sale.insertMany([
        {
          items: [
            {
              product: adminUser!._id,
              productNameSnapshot: 'A',
              quantity: 1,
              unitPriceSnapshot: 10,
              subtotal: 10,
            },
          ],
          grandTotal: 10,
          soldBy: adminUser!._id,
        },
        {
          items: [
            {
              product: adminUser!._id,
              productNameSnapshot: 'B',
              quantity: 2,
              unitPriceSnapshot: 5,
              subtotal: 10,
            },
          ],
          grandTotal: 10,
          soldBy: adminUser!._id,
        },
        {
          items: [
            {
              product: adminUser!._id,
              productNameSnapshot: 'C',
              quantity: 1,
              unitPriceSnapshot: 20,
              subtotal: 20,
            },
          ],
          grandTotal: 20,
          soldBy: adminUser!._id,
        },
      ]);
    });

    it('returns a paginated list with meta', async () => {
      const res = await request.get('/api/sales').set('Authorization', `Bearer ${adminToken}`);
      if (res.status === 400) console.log('400 Error Body:', res.body);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 3 });
    });

    it('paginates correctly', async () => {
      const res = await request
        .get('/api/sales?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3 });
    });

    it('returns 403 for a user without sale:view permission', async () => {
      const res = await request.get('/api/sales').set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('employee without sale:view cannot list sales', async () => {
      const res = await request.get('/api/sales').set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/sales/:id ────────────────────────────────────────────────────────

  describe('GET /api/sales/:id', () => {
    it('returns the full sale detail', async () => {
      const adminUser = await User.findOne({ email: 'admin@test.com' });
      const sale = await Sale.create({
        items: [
          {
            product: adminUser!._id,
            productNameSnapshot: 'Widget',
            quantity: 2,
            unitPriceSnapshot: 15,
            subtotal: 30,
          },
        ],
        grandTotal: 30,
        soldBy: adminUser!._id,
      });

      const res = await request
        .get(`/api/sales/${sale._id.toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.grandTotal).toBe(30);
      expect(res.body.data.items[0].productNameSnapshot).toBe('Widget');
    });

    it('returns 404 for an unknown ID', async () => {
      const res = await request
        .get('/api/sales/000000000000000000000001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 403 for a user without sale:view permission', async () => {
      const adminUser = await User.findOne({ email: 'admin@test.com' });
      const sale = await Sale.create({
        items: [
          {
            product: adminUser!._id,
            productNameSnapshot: 'X',
            quantity: 1,
            unitPriceSnapshot: 5,
            subtotal: 5,
          },
        ],
        grandTotal: 5,
        soldBy: adminUser!._id,
      });

      const res = await request
        .get(`/api/sales/${sale._id.toString()}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
