import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Permission } from '../role/permission.model.js';
import { Role } from '../role/role.model.js';
import { User } from './user.model.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import authRouter from '../auth/auth.routes.js';
import userRouter from './user.routes.js';

const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.use('/api/users', userRouter);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

async function loginAs(email: string): Promise<string> {
  const res = await request.post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken as string;
}

describe('User module', () => {
  let adminToken: string;
  let viewerToken: string;
  let adminRoleId: string;
  let viewerRoleId: string;

  beforeAll(async () => {
    await Promise.all([Permission.createIndexes(), Role.createIndexes(), User.createIndexes()]);
  });

  beforeEach(async () => {
    const [createPerm, viewPerm, updatePerm] = await Permission.insertMany([
      { key: 'user:create', module: 'user', description: '' },
      { key: 'user:view', module: 'user', description: '' },
      { key: 'user:update', module: 'user', description: '' },
    ]);

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [createPerm._id, viewPerm._id, updatePerm._id],
      isSystemRole: true,
    });
    adminRoleId = adminRole._id.toString();

    const viewerRole = await Role.create({
      name: 'Viewer',
      permissions: [],
      isSystemRole: false,
    });
    viewerRoleId = viewerRole._id.toString();

    await User.create({
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

    [adminToken, viewerToken] = await Promise.all([
      loginAs('admin@test.com'),
      loginAs('viewer@test.com'),
    ]);
  });

  // ── POST /api/users ──────────────────────────────────────────────────────

  describe('POST /api/users', () => {
    it('creates successfully with valid data and required permission', async () => {
      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New User',
          email: 'new@test.com',
          password: 'Password123',
          role: viewerRoleId,
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'New User',
        email: 'new@test.com',
        isActive: true,
      });
      expect(res.body.data.password).toBeUndefined(); // ensure password is not returned
    });

    it('returns 400 on invalid input (Zod validation)', async () => {
      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'N', // too short
          email: 'not-an-email',
          password: '123', // too short
          role: 'not-an-objectid',
        });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 409 on a uniqueness conflict', async () => {
      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Duplicate',
          email: 'admin@test.com',
          password: 'Password123',
          role: adminRoleId,
        });
      expect(res.status).toBe(409);
    });

    it('returns 403 when user lacks user:create permission', async () => {
      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Another User',
          email: 'another@test.com',
          password: 'Password123',
          role: viewerRoleId,
        });
      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request.post('/api/users').send({
        name: 'No Token User',
        email: 'notoken@test.com',
        password: 'Password123',
        role: viewerRoleId,
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when role ID is a valid ObjectId but does not exist', async () => {
      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ghost Role User',
          email: 'ghost@test.com',
          password: 'Password123',
          role: '000000000000000000000001',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid role/i);
    });
  });

  // ── GET /api/users ───────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('returns a paginated list with correct meta', async () => {
      const res = await request.get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 2 });
    });

    it('paginates correctly', async () => {
      const res = await request
        .get('/api/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('returns 403 when user lacks user:view permission', async () => {
      const res = await request.get('/api/users').set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/users/:id ───────────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('returns the resource by ID', async () => {
      const resCreate = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Fetch Me',
          email: 'fetch@test.com',
          password: 'Password123',
          role: viewerRoleId,
        });

      const userId = resCreate.body.data._id;
      const res = await request
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Fetch Me');
    });

    it('returns 404 for an unknown ID', async () => {
      const res = await request
        .get('/api/users/000000000000000000000001')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/users/:id ─────────────────────────────────────────────────

  describe('PATCH /api/users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      const resCreate = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Update Me',
          email: 'update@test.com',
          password: 'Password123',
          role: viewerRoleId,
        });
      testUserId = resCreate.body.data._id;
    });

    it('updates fields and returns the updated document', async () => {
      const res = await request
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name',
          isActive: false,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.isActive).toBe(false);
    });

    it('returns 409 if trying to update email to one that already exists', async () => {
      const res = await request
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@test.com',
        });
      expect(res.status).toBe(409);
    });

    it('returns 404 for a non-existent ID', async () => {
      const res = await request
        .patch('/api/users/000000000000000000000001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New' });
      expect(res.status).toBe(404);
    });

    it('returns 403 when user lacks user:update permission', async () => {
      const res = await request
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'New' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when updating to a role ID that does not exist', async () => {
      const res = await request
        .patch(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: '000000000000000000000001' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid role/i);
    });

    it('returns 400 when attempting to deactivate own account', async () => {
      // First, fetch the admin user to get their ID
      const adminRes = await request
        .get('/api/users?search=admin@test.com')
        .set('Authorization', `Bearer ${adminToken}`);

      const adminId = adminRes.body.data[0]._id;

      const res = await request
        .patch(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot deactivate your own account/i);
    });
  });
});
