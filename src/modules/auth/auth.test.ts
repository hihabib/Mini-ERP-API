import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { Permission } from '../role/permission.model.js';
import { Role } from '../role/role.model.js';
import { User } from '../user/user.model.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess } from '../../shared/apiResponse.js';
import authRouter from './auth.routes.js';

// Minimal test app: real auth routes + a throwaway route to exercise permission middleware
const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.get(
  '/api/test/product-create',
  authenticate,
  requirePermission('product:create'),
  (_req: Request, res: Response) => {
    sendSuccess(res, { message: 'ok', data: {} });
  },
);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractRefreshCookie(setCookieHeader: string): string {
  return setCookieHeader.split(';')[0]; // "refreshToken=<value>"
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Auth module', () => {
  beforeAll(async () => {
    await Permission.createIndexes();
    await Role.createIndexes();
    await User.createIndexes();
  });

  beforeEach(async () => {
    // Global afterEach in tests/setup.ts wipes every collection after each test.
    // Recreate the fixtures fresh here so every test starts from a clean state.
    const createPerm = await Permission.create({
      key: 'product:create',
      module: 'product',
      description: '',
    });
    const viewPerm = await Permission.create({
      key: 'product:view',
      module: 'product',
      description: '',
    });

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [createPerm._id, viewPerm._id],
      isSystemRole: true,
    });
    const employeeRole = await Role.create({
      name: 'Employee',
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
      name: 'Employee User',
      email: 'employee@test.com',
      password: 'Test@1234',
      role: employeeRole._id,
    });
  });

  // ── POST /api/auth/login ───────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns access token and sets httpOnly refresh cookie on valid credentials', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(res.body.data.user.email).toBe('admin@test.com');
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.role.name).toBe('Admin');
      expect(Array.isArray(res.body.data.user.role.permissions)).toBe(true);

      const rawHeader = res.headers['set-cookie'];
      const setCookieHeader = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader) ?? '';
      expect(setCookieHeader).toContain('refreshToken=');
      expect(setCookieHeader).toContain('HttpOnly');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'Test@1234' });

      expect(res.status).toBe(401);
    });

    it('returns 422 when email is missing', async () => {
      const res = await request.post('/api/auth/login').send({ password: 'Test@1234' });
      expect(res.status).toBe(400);
    });

    it('returns 422 when password is missing', async () => {
      const res = await request.post('/api/auth/login').send({ email: 'admin@test.com' });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with a malformed token', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.token');
      expect(res.status).toBe(401);
    });

    it('returns the authenticated user with populated role and permissions', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('admin@test.com');
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.role.name).toBe('Admin');
      expect(res.body.data.role.permissions).toHaveLength(2);
    });
  });

  // ── POST /api/auth/refresh ────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('issues a new access token when a valid refresh cookie is present', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234' });

      const rawCookie = loginRes.headers['set-cookie'];
      const firstCookie = (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie) ?? '';
      const cookieValue = extractRefreshCookie(firstCookie);

      const res = await request.post('/api/auth/refresh').set('Cookie', cookieValue);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('returns 401 when refresh cookie is absent', async () => {
      const res = await request.post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('clears the refresh cookie and returns 200', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request.post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const logoutHeader = res.headers['set-cookie'];
      const setCookie = (Array.isArray(logoutHeader) ? logoutHeader[0] : logoutHeader) ?? '';
      expect(setCookie).toMatch(/refreshToken=;|refreshToken=$/);
    });
  });

  // ── Permission middleware ──────────────────────────────────────────────────

  describe('Permission middleware (via /api/test/product-create)', () => {
    it('grants access when the user has the required permission', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Test@1234' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request
        .get('/api/test/product-create')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 403 when the user lacks the required permission', async () => {
      // Employee has only product:view, not product:create
      const loginRes = await request
        .post('/api/auth/login')
        .send({ email: 'employee@test.com', password: 'Test@1234' });
      const token = loginRes.body.data.accessToken as string;

      const res = await request
        .get('/api/test/product-create')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request.get('/api/test/product-create');
      expect(res.status).toBe(401);
    });
  });
});
