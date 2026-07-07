import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Permission } from '../role/permission.model.js';
import { Role } from '../role/role.model.js';
import { User } from '../user/user.model.js';
import { Product } from '../product/product.model.js';
import { Sale } from '../sale/sale.model.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import authRouter from '../auth/auth.routes.js';
import dashboardRouter from './dashboard.routes.js';

const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.use('/api/dashboard', dashboardRouter);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

async function loginAs(email: string): Promise<string> {
  const res = await request.post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken as string;
}

let sku = 0;
function makeProduct(stockQuantity: number, sellingPrice = 10) {
  return {
    name: `Product ${++sku}`,
    sku: `SKU-${sku}`,
    category: 'test',
    purchasePrice: 5,
    sellingPrice,
    stockQuantity,
    imageUrl: '/uploads/test.png',
  };
}

function makeSale(grandTotal: number, soldById: string) {
  return {
    items: [
      {
        product: '000000000000000000000001',
        productNameSnapshot: 'Test',
        quantity: 1,
        unitPriceSnapshot: grandTotal,
        subtotal: grandTotal,
      },
    ],
    grandTotal,
    soldBy: soldById,
  };
}

describe('Dashboard module', () => {
  let adminToken: string;
  let viewerToken: string;
  let adminUserId: string;

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
    // Global afterEach in tests/setup.ts wipes all collections — recreate here.
    const [dashPerm] = await Permission.insertMany([
      { key: 'dashboard:view', module: 'dashboard', description: '' },
    ]);

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [dashPerm._id],
      isSystemRole: true,
    });
    const viewerRole = await Role.create({
      name: 'Viewer',
      permissions: [],
      isSystemRole: false,
    });

    const adminUser = await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: 'Test@1234',
      role: adminRole._id,
    });
    await User.create({
      name: 'Viewer',
      email: 'viewer@test.com',
      password: 'Test@1234',
      role: viewerRole._id,
    });

    adminUserId = adminUser._id.toString();
    [adminToken, viewerToken] = await Promise.all([
      loginAs('admin@test.com'),
      loginAs('viewer@test.com'),
    ]);
  });

  describe('GET /api/dashboard/stats', () => {
    it('returns correct counts and totalRevenue for known fixture data', async () => {
      // 3 low-stock (qty < 5), 2 normal
      await Product.insertMany([
        makeProduct(1),
        makeProduct(2),
        makeProduct(4),
        makeProduct(10),
        makeProduct(50),
      ]);
      // 3 sales: grandTotals 100, 200, 150 → sum = 450
      await Sale.insertMany([
        makeSale(100, adminUserId),
        makeSale(200, adminUserId),
        makeSale(150, adminUserId),
      ]);

      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalProducts).toBe(5);
      expect(res.body.data.totalSales).toBe(3);
      expect(res.body.data.totalRevenue).toBe(450);
      expect(res.body.data.lowStockCount).toBe(3);
      expect(res.body.data.lowStockProducts).toHaveLength(3);
    });

    it('lowStockProducts contains only products with stockQuantity < 5', async () => {
      await Product.insertMany([
        makeProduct(0),
        makeProduct(3),
        makeProduct(5), // NOT low-stock (threshold is < 5, not ≤ 5)
        makeProduct(20),
      ]);

      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const lowStock = res.body.data.lowStockProducts as Array<{ stockQuantity: number }>;
      expect(lowStock).toHaveLength(2);
      lowStock.forEach((p) => expect(p.stockQuantity).toBeLessThan(5));
    });

    it('lowStockProducts is sorted ascending by stockQuantity (most urgent first)', async () => {
      await Product.insertMany([makeProduct(4), makeProduct(1), makeProduct(3), makeProduct(0)]);

      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const quantities = (res.body.data.lowStockProducts as Array<{ stockQuantity: number }>).map(
        (p) => p.stockQuantity,
      );
      expect(quantities).toEqual([...quantities].sort((a, b) => a - b));
    });

    it('caps lowStockProducts at 10 but lowStockCount reflects the true total', async () => {
      // Seed 15 low-stock products
      await Product.insertMany(Array.from({ length: 15 }, (_, i) => makeProduct(i % 4)));
      // Plus 5 normal-stock products
      await Product.insertMany(Array.from({ length: 5 }, () => makeProduct(20)));

      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lowStockProducts).toHaveLength(10); // capped
      expect(res.body.data.lowStockCount).toBe(15); // true total
      expect(res.body.data.totalProducts).toBe(20);
    });

    it('lowStockProducts only includes _id, name, sku, stockQuantity fields', async () => {
      await Product.insertMany([makeProduct(2)]);

      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const p = res.body.data.lowStockProducts[0] as Record<string, unknown>;
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('sku');
      expect(p).toHaveProperty('stockQuantity');
      expect(p).not.toHaveProperty('purchasePrice');
      expect(p).not.toHaveProperty('imageUrl');
    });

    it('returns zeros when there is no data', async () => {
      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalProducts).toBe(0);
      expect(res.body.data.totalSales).toBe(0);
      expect(res.body.data.totalRevenue).toBe(0);
      expect(res.body.data.lowStockCount).toBe(0);
      expect(res.body.data.lowStockProducts).toHaveLength(0);
    });

    it('returns 403 when user lacks dashboard:view permission', async () => {
      const res = await request
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request.get('/api/dashboard/stats');
      expect(res.status).toBe(401);
    });
  });
});
