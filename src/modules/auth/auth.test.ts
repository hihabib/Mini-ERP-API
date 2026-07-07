import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import app from '../../app.js';

const request = supertest(app);

describe('Health check', () => {
  it('GET /health returns 200 with ok status', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});
