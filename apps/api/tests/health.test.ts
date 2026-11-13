import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { configSchema } from '../src/config.js';
describe('service boundaries', () => {
  it('reports liveness independently of database readiness', async () => {
    const app = createApp(() => false);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/api/v1/ready')).status).toBe(503);
  });
  it('reports a connected database', async () => {
    expect((await request(createApp(() => true)).get('/api/v1/ready')).status).toBe(200);
  });
  it('returns structured errors and security headers', async () => {
    const result = await request(createApp(() => false)).get('/missing');
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('NOT_FOUND');
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(result.headers['x-powered-by']).toBeUndefined();
  });
  it('rejects malformed and oversized request bodies without exposing details', async () => {
    const app = createApp(() => false);
    const malformed = await request(app)
      .post('/missing')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    const oversized = await request(app)
      .post('/missing')
      .send({ value: 'x'.repeat(33000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
  it('rejects invalid database and port configuration', () => {
    expect(configSchema.safeParse({ DATABASE_URL: 'https://invalid', PORT: 0 }).success).toBe(
      false,
    );
  });
});
