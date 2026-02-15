import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAllUsers: vi.fn(),
  findUserById: vi.fn(),
  updateUserBlocked: vi.fn(),
  insertAuditLog: vi.fn(),
  updateUserPlan: vi.fn(),
  setUserAdmin: vi.fn(),
  findAllContactMessages: vi.fn(),
  deleteContactMessage: vi.fn(),
  getAnalytics: vi.fn(),
  getConfig: vi.fn(),
  findAuditLogs: vi.fn(),
  countAuditLogs: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('../db/repositories', () => ({
  findAllUsers: mocks.findAllUsers,
  findUserById: mocks.findUserById,
  updateUserBlocked: mocks.updateUserBlocked,
  insertAuditLog: mocks.insertAuditLog,
  updateUserPlan: mocks.updateUserPlan,
  setUserAdmin: mocks.setUserAdmin,
  findAllContactMessages: mocks.findAllContactMessages,
  deleteContactMessage: mocks.deleteContactMessage,
  getAnalytics: mocks.getAnalytics,
  getConfig: mocks.getConfig,
  findAuditLogs: mocks.findAuditLogs,
  countAuditLogs: mocks.countAuditLogs,
}));

import adminRouter from '../routes/admin';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  return app;
}

describe('admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { userId: 10, email: 'admin@example.com' };
      next();
    });
    mocks.getConfig.mockImplementation((key: string) => {
      if (key === 'audit_log_default_limit') return '50';
      if (key === 'audit_log_max_limit') return '200';
      return null;
    });
    mocks.findAllUsers.mockReturnValue([]);
    mocks.getAnalytics.mockReturnValue({ total: 0, costTotal: 0, tokensTotal: 0 });
    mocks.findAuditLogs.mockReturnValue([]);
    mocks.countAuditLogs.mockReturnValue(0);
  });

  it('GET /users maps repository users for admin UI', async () => {
    const app = createApp();
    mocks.findAllUsers.mockReturnValue([
      {
        id: 2,
        email: 'user@example.com',
        is_admin: 1,
        plan: 'pro',
        blocked: 1,
        blocked_reason: 'abuse',
        stripe_subscription_status: 'active',
        created_at: '2026-01-10 09:00:00',
        last_login_at: '2026-02-12 12:00:00',
      },
    ]);

    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 2,
        email: 'user@example.com',
        isAdmin: true,
        plan: 'pro',
        blocked: true,
        blockedReason: 'abuse',
        stripeSubscriptionStatus: 'active',
        createdAt: '2026-01-10 09:00:00',
        lastLoginAt: '2026-02-12 12:00:00',
      },
    ]);
  });

  it('PUT /users/:id/block refuses blocking yourself', async () => {
    const app = createApp();
    mocks.findUserById.mockReturnValue({ id: 10, email: 'admin@example.com' });

    const res = await request(app)
      .put('/api/admin/users/10/block')
      .send({ blocked: true, reason: 'spam' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Cannot block yourself' });
    expect(mocks.updateUserBlocked).not.toHaveBeenCalled();
    expect(mocks.insertAuditLog).not.toHaveBeenCalled();
  });

  it('PUT /users/:id/plan rejects invalid plan', async () => {
    const app = createApp();
    mocks.findUserById.mockReturnValue({ id: 2, email: 'user@example.com' });

    const res = await request(app)
      .put('/api/admin/users/2/plan')
      .send({ plan: 'vip' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Validation failed', details: expect.any(Array) });
    expect(mocks.updateUserPlan).not.toHaveBeenCalled();
  });

  it('GET /stats returns aggregated admin stats', async () => {
    const app = createApp();
    mocks.findAllUsers.mockReturnValue([
      { id: 1, plan: 'free', blocked: 0, last_login_at: null },
      { id: 2, plan: 'pro', blocked: 1, last_login_at: '2026-02-12 10:00:00' },
      { id: 3, plan: null, blocked: 0, last_login_at: '2026-02-12 11:00:00' },
    ]);
    mocks.getAnalytics.mockReturnValue({ total: 12, costTotal: 7.25, tokensTotal: 999 });

    const res = await request(app).get('/api/admin/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalUsers: 3,
      activeUsers: 2,
      blockedUsers: 1,
      planCounts: {
        free: 2,
        pro: 1,
        enterprise: 0,
      },
      totalTickets: 12,
      totalCost: 7.25,
      totalTokens: 999,
    });
  });

  it('GET /logs with auth category merges login and dev_login logs', async () => {
    const app = createApp();
    mocks.findAuditLogs.mockImplementation((limit: number, offset: number, action?: string) => {
      if (limit !== 5 || offset !== 0) return [];
      if (action === 'login') {
        return [{ id: 1, action: 'login', created_at: '2026-02-12T10:00:00' }];
      }
      if (action === 'dev_login') {
        return [{ id: 2, action: 'dev_login', created_at: '2026-02-12T12:00:00' }];
      }
      return [];
    });
    mocks.countAuditLogs.mockImplementation((action?: string) => {
      if (action === 'login') return 1;
      if (action === 'dev_login') return 1;
      return 0;
    });

    const res = await request(app).get('/api/admin/logs?category=auth&limit=5&offset=0');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.logs).toEqual([
      { id: 2, action: 'dev_login', created_at: '2026-02-12T12:00:00' },
      { id: 1, action: 'login', created_at: '2026-02-12T10:00:00' },
    ]);
  });

  it('GET /logs applies mapped category filters and max limit', async () => {
    const app = createApp();
    mocks.findAuditLogs.mockReturnValue([{ id: 10, action: 'ticket_create', created_at: '2026-02-12T08:00:00' }]);
    mocks.countAuditLogs.mockReturnValue(1);

    const res = await request(app).get('/api/admin/logs?category=ticket&limit=9999&offset=0');

    expect(res.status).toBe(200);
    expect(mocks.findAuditLogs).toHaveBeenCalledWith(200, 0, 'ticket_');
    expect(mocks.countAuditLogs).toHaveBeenCalledWith('ticket_');
  });

  it('GET /logs with feedback category filters by onboard_feedback', async () => {
    const app = createApp();
    mocks.findAuditLogs.mockReturnValue([
      { id: 20, action: 'onboard_feedback', created_at: '2026-02-14T09:00:00' },
    ]);
    mocks.countAuditLogs.mockReturnValue(1);

    const res = await request(app).get('/api/admin/logs?category=feedback&limit=50&offset=0');

    expect(res.status).toBe(200);
    expect(mocks.findAuditLogs).toHaveBeenCalledWith(50, 0, 'onboard_feedback');
    expect(mocks.countAuditLogs).toHaveBeenCalledWith('onboard_feedback');
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0].action).toBe('onboard_feedback');
  });
});
