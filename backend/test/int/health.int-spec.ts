import request from 'supertest';
import { createTestApp, type TestApp } from '../helpers/test-app';

describe('health (int)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('GET /api/v1/health reports db ok with no-store', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('unknown route returns the NOT_FOUND envelope', async () => {
    const res = await request(t.app.getHttpServer()).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('malformed JSON body returns VALIDATION_FAILED, not 500', async () => {
    const res = await request(t.app.getHttpServer())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
