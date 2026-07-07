# Backend Module Test Template

Every new module's test file must follow this shape. Reference this document when scaffolding a new feature — don't re-derive the structure each time.

## File location

```
src/modules/<feature>/<feature>.test.ts
```

## Standard shape

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
// Import Mongoose models for fixtures
import { Permission } from '../role/permission.model.js';
import { Role } from '../role/role.model.js';
import { User } from '../user/user.model.js';
import { globalErrorHandler } from '../../middlewares/error.middleware.js';
import authRouter from '../auth/auth.routes.js';
import <feature>Router from './<feature>.routes.js';

// If the module emits socket events, mock the socket module here.
// vi.mock('../../config/socket.js', () => ({ emitX: vi.fn(), ... }));

const testApp = express();
testApp.use(express.json());
testApp.use(cookieParser());
testApp.use('/api/auth', authRouter);
testApp.use('/api/<resource>', <feature>Router);
testApp.use(globalErrorHandler);

const request = supertest(testApp);

async function loginAs(email: string): Promise<string> {
  const res = await request.post('/api/auth/login').send({ email, password: 'Test@1234' });
  return res.body.data.accessToken as string;
}

describe('<Feature> module', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    // Create indexes once — the global afterEach wipes documents, not indexes.
    await Promise.all([
      Permission.createIndexes(),
      Role.createIndexes(),
      User.createIndexes(),
      // Add any module-specific model index creation here.
    ]);
  });

  beforeEach(async () => {
    // Global afterEach in tests/setup.ts wipes all collections after each test.
    // Re-seed fixtures here so every test starts from a clean, known state.
    const [createPerm, viewPerm] = await Permission.insertMany([
      { key: '<resource>:create', module: '<resource>', description: '' },
      { key: '<resource>:view',   module: '<resource>', description: '' },
    ]);

    const adminRole = await Role.create({
      name: 'Admin',
      permissions: [createPerm._id, viewPerm._id],
      isSystemRole: true,
    });
    const viewerRole = await Role.create({
      name: 'Viewer',
      permissions: [],
      isSystemRole: false,
    });

    await User.create({ name: 'Admin',  email: 'admin@test.com',  password: 'Test@1234', role: adminRole._id });
    await User.create({ name: 'Viewer', email: 'viewer@test.com', password: 'Test@1234', role: viewerRole._id });

    [adminToken, viewerToken] = await Promise.all([
      loginAs('admin@test.com'),
      loginAs('viewer@test.com'),
    ]);
  });

  // ── POST /api/<resource> ──────────────────────────────────────────────────────

  describe('POST /api/<resource>', () => {
    it('creates successfully with valid data and required permission', async () => {
      // Arrange: valid payload
      // Act
      const res = await request
        .post('/api/<resource>')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ /* valid payload */ });
      // Assert
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ /* expected fields */ });
    });

    it('returns 400 on invalid input (Zod validation)', async () => {
      const res = await request
        .post('/api/<resource>')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ /* deliberately invalid payload */ });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    // If the resource has a unique constraint:
    it('returns 409 on a uniqueness conflict', async () => {
      // create the first one, then try to create a duplicate
    });

    it('returns 403 when user lacks <resource>:create permission', async () => {
      const res = await request
        .post('/api/<resource>')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ /* valid payload */ });
      expect(res.status).toBe(403);
    });

    it('returns 401 without a token', async () => {
      const res = await request.post('/api/<resource>').send({ /* payload */ });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/<resource> ───────────────────────────────────────────────────────

  describe('GET /api/<resource>', () => {
    beforeEach(async () => {
      // Seed list fixture data
    });

    it('returns a paginated list with correct meta', async () => {
      const res = await request
        .get('/api/<resource>')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: expect.any(Number) });
    });

    it('filters by search/category/etc correctly', async () => {
      // test with ?search=... or other filters
    });

    it('paginates correctly', async () => {
      const res = await request
        .get('/api/<resource>?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('returns 403 when user lacks <resource>:view permission', async () => {
      const res = await request
        .get('/api/<resource>')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/<resource>/:id ───────────────────────────────────────────────────

  describe('GET /api/<resource>/:id', () => {
    it('returns the resource by ID', async () => {
      // create, then fetch
    });

    it('returns 404 for an unknown ID', async () => {
      const res = await request
        .get('/api/<resource>/000000000000000000000001')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/<resource>/:id ─────────────────────────────────────────────────

  describe('PATCH /api/<resource>/:id', () => {
    it('updates fields and returns the updated document', async () => {
      // create, patch, assert
    });

    it('returns 404 for a non-existent ID', async () => { /* ... */ });

    it('returns 403 when user lacks <resource>:update permission', async () => { /* ... */ });
  });

  // ── DELETE /api/<resource>/:id ────────────────────────────────────────────────

  describe('DELETE /api/<resource>/:id', () => {
    it('returns 204 and a subsequent GET returns 404', async () => {
      // create, delete, then GET should 404
    });

    it('returns 404 for a non-existent ID', async () => { /* ... */ });

    it('returns 403 when user lacks <resource>:delete permission', async () => { /* ... */ });
  });

  // ── Business-rule-specific behaviour ─────────────────────────────────────────

  describe('<specific business rule>', () => {
    it('describes the specific invariant being tested', async () => {
      // e.g. stock never goes negative, old image deleted, snapshot preserved, etc.
    });
  });
});
```

## Checklist for every new module test file

- [ ] `beforeAll` — call `createIndexes()` for every model referenced
- [ ] `beforeEach` — re-seed permissions, roles, and users from scratch (global `afterEach` wipes collections)
- [ ] Happy path `201` / `200` with response shape assertion
- [ ] Zod validation `400` with `errors` field
- [ ] `409` for any uniqueness constraint
- [ ] `403` for **every** permission-protected route (not just one representative)
- [ ] `401` on at least one protected route
- [ ] `404` for non-existent resource IDs
- [ ] Business-rule edge cases (rollback, snapshot fidelity, cleanup, concurrency)
- [ ] Socket events (if the module emits): verify with `vi.mock` + `toHaveBeenCalledWith`

## Conventions

| Convention | Rationale |
|---|---|
| Build a minimal `testApp` per test file — never import `src/app.ts` | Keeps tests isolated; avoids cross-module route pollution |
| Use `MongoMemoryReplSet` (configured in `tests/setup.ts`) | Enables multi-document transactions |
| Seed fixtures in `beforeEach`, rely on global `afterEach` to wipe | Each test starts from a consistent, known state |
| Never hardcode admin credentials — seed via `User.create` | Matches the no-hardcoded-secrets rule |
| Assert on `res.body.data` shape, not just `res.status` | Catches regressions in response serialisation |
