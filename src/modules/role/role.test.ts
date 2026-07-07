import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Permission } from './permission.model.js';
import { Role } from './role.model.js';
import { User } from '../user/user.model.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import authRouter from '../auth/auth.routes.js';
import roleRouter from './role.routes.js';

const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.use('/api/roles', roleRouter);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

async function loginAs(email: string): Promise<string> {
  const res = await request.post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken as string;
}

describe('Role module', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    await Promise.all([Permission.createIndexes(), Role.createIndexes(), User.createIndexes()]);
  });

  beforeEach(async () => {
    const [viewPerm] = await Permission.insertMany([
      { key: 'user:view', module: 'user', description: '' },
    ]);

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [viewPerm._id],
      isSystemRole: true,
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

  // ── GET /api/roles ────────────────────────────────────────────────────────

  describe('GET /api/roles', () => {
    it('returns all roles with populated permissions for an authorized user', async () => {
      const res = await request.get('/api/roles').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);

      type RoleShape = { name: string; permissions: Array<{ key: string }> };
      const admin = (res.body.data as RoleShape[]).find((r) => r.name === 'Admin');
      expect(admin).toBeDefined();
      expect(Array.isArray(admin!.permissions)).toBe(true);
      expect(admin!.permissions[0].key).toBe('user:view');
    });

    it('returns 403 when user lacks user:view permission', async () => {
      const res = await request.get('/api/roles').set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request.get('/api/roles');
      expect(res.status).toBe(401);
    });
  });
});
