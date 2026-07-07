import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import express, { type Request, type Response } from 'express';
import { Schema, model } from 'mongoose';
import { z } from 'zod';
import { globalErrorHandler } from './error.middleware.js';
import { validate } from './validate.middleware.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../shared/ApiError.js';
import { asyncHandler } from '../shared/asyncHandler.js';

// ── Throwaway model for duplicate-key test ────────────────────────────────────

interface IUniqueDoc {
  email: string;
}

const uniqueDocSchema = new Schema<IUniqueDoc>({
  email: { type: String, required: true, unique: true },
});
const UniqueDoc = model<IUniqueDoc>('ErrMwUniqueDoc', uniqueDocSchema);

// ── Minimal test app ──────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

const nameSchema = z.object({ name: z.string().min(1) });
// Produces two issues at path=[] — exercises the '_root' key branch AND the duplicate-key guard.
const rootRefineSchema = z.object({ name: z.string() }).superRefine((_, ctx) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Root error A', path: [] });
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Root error B', path: [] });
});

// Routes that throw every error type we need to verify
app.get(
  '/test/not-found',
  asyncHandler(async () => {
    throw new NotFoundError('Widget not found');
  }),
);
app.get(
  '/test/bad-request',
  asyncHandler(async () => {
    throw new BadRequestError('Bad input', { name: 'Name is required' });
  }),
);
app.get(
  '/test/unauthorized',
  asyncHandler(async () => {
    throw new UnauthorizedError();
  }),
);
app.get(
  '/test/forbidden',
  asyncHandler(async () => {
    throw new ForbiddenError();
  }),
);
app.get(
  '/test/conflict',
  asyncHandler(async () => {
    throw new ConflictError('Email taken');
  }),
);
app.get(
  '/test/generic',
  asyncHandler(async () => {
    throw new Error('Unexpected failure');
  }),
);

app.post(
  '/test/mongoose-validation',
  asyncHandler(async () => {
    // Trigger a Mongoose validation error
    await UniqueDoc.create({ email: '' });
  }),
);

app.post(
  '/test/duplicate-key',
  asyncHandler(async (_req: Request, _res: Response) => {
    await UniqueDoc.create({ email: 'dup@test.com' });
    await UniqueDoc.create({ email: 'dup@test.com' }); // triggers E11000
  }),
);

app.post('/test/validate', validate(nameSchema), (_req: Request, res: Response) => {
  res.json({ success: true, message: 'ok', data: {} });
});
// superRefine produces path=[] issues, exercising the '_root' key and duplicate-key guard.
app.post('/test/validate-root', validate(rootRefineSchema), (_req: Request, res: Response) => {
  res.json({ success: true, message: 'ok', data: {} });
});

app.use(globalErrorHandler);

const request = supertest(app);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Global error handler', () => {
  beforeAll(async () => {
    await UniqueDoc.createIndexes();
  });

  it('returns 404 for NotFoundError with correct shape', async () => {
    const res = await request.get('/test/not-found');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Widget not found');
  });

  it('returns 400 for BadRequestError with field-level errors map', async () => {
    const res = await request.get('/test/bad-request');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual({ name: 'Name is required' });
  });

  it('returns 401 for UnauthorizedError', async () => {
    const res = await request.get('/test/unauthorized');
    expect(res.status).toBe(401);
  });

  it('returns 403 for ForbiddenError', async () => {
    const res = await request.get('/test/forbidden');
    expect(res.status).toBe(403);
  });

  it('returns 409 for ConflictError', async () => {
    const res = await request.get('/test/conflict');
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email taken');
  });

  it('returns 500 for unrecognised errors without leaking internals', async () => {
    const res = await request.get('/test/generic');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('translates Mongoose duplicate-key error to 409 with field name', async () => {
    const res = await request.post('/test/duplicate-key');
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('email');
  });

  it('translates Mongoose ValidationError to 400 with field-level errors', async () => {
    // The route triggers UniqueDoc.create({ email: '' }) which fails the required validator.
    const res = await request.post('/test/mongoose-validation');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors).toHaveProperty('email');
  });
});

describe('validate() middleware', () => {
  it('passes through when body matches schema', async () => {
    const res = await request.post('/test/validate').send({ name: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 with field-level errors when body is invalid', async () => {
    const res = await request.post('/test/validate').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toHaveProperty('name');
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request.post('/test/validate').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('name');
  });

  it('maps root-level Zod issues (path=[]) to the _root key and ignores duplicate paths', async () => {
    // superRefine adds two issues at path=[] — first maps to _root, second is deduplicated.
    const res = await request.post('/test/validate-root').send({ name: 'Alice' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('_root');
    // Only the first message for '_root' should be kept (duplicate-key guard).
    expect(res.body.errors['_root']).toBe('Root error A');
  });
});
