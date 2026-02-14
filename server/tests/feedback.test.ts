import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  insertAuditLog: vi.fn(),
}));

vi.mock('../db/repositories', () => ({
  insertAuditLog: mocks.insertAuditLog,
}));

// Bypass rate limiter in tests — passthrough middleware
vi.mock('express-rate-limit', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

import feedbackRouter from '../routes/feedback';

function createApp(user?: { userId: number; email: string }) {
  const app = express();
  app.use(express.json());
  if (user) {
    app.use((req: any, _res: any, next: any) => {
      req.user = user;
      next();
    });
  }
  app.use('/api/feedback', feedbackRouter);
  return app;
}

describe('feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST / with valid rating returns ok and inserts audit log', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: 4 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mocks.insertAuditLog).toHaveBeenCalledOnce();
    expect(mocks.insertAuditLog).toHaveBeenCalledWith(
      null,
      'anonymous',
      'onboard_feedback',
      'feedback',
      undefined,
      '4/5',
      expect.any(String),
    );
  });

  it('POST / with authenticated user uses their info', async () => {
    const app = createApp({ userId: 7, email: 'user@example.com' });

    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: 5 });

    expect(res.status).toBe(200);
    expect(mocks.insertAuditLog).toHaveBeenCalledWith(
      7,
      'user@example.com',
      'onboard_feedback',
      'feedback',
      undefined,
      '5/5',
      expect.any(String),
    );
  });

  it('POST / rejects rating below 1', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
  });

  it('POST / rejects rating above 5', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: 6 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
  });

  it('POST / rejects non-integer rating', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: 3.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
  });

  it('POST / rejects missing rating', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/feedback')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
  });

  it('POST / rejects string rating', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/feedback')
      .send({ rating: 'five' });

    expect(res.status).toBe(400);
    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
  });
});
