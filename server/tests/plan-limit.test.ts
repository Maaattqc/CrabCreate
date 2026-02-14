import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock repositories
vi.mock('../db/repositories', () => ({
  findUserById: vi.fn(),
  getConfig: vi.fn(),
  countUserTicketsThisMonth: vi.fn(),
  countUserActivePipelines: vi.fn(),
}));

import * as repo from '../db/repositories';
import { checkTicketLimit, checkPipelineLimit } from '../middleware/plan-limit';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReq(userId = 1, projectId = 10): Request {
  return {
    user: { userId, email: 'test@example.com' },
    project: { id: projectId, name: 'Test', slug: 'test', ownerId: 1, isPrivate: true, userRole: 'member' },
  } as unknown as Request;
}

function createMockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

function mockUser(overrides: Partial<{ id: number; is_admin: number; plan: string }> = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    is_admin: 0,
    plan: 'free',
    blocked: 0,
    blocked_reason: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_subscription_status: null,
    preferences: '{}',
    created_at: '2024-01-01',
    last_login_at: null,
    ...overrides,
  };
}

// ── checkTicketLimit ─────────────────────────────────────────────────────────

describe('checkTicketLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user not found', () => {
    vi.mocked(repo.findUserById).mockReturnValue(undefined);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('bypasses limit for admin users', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ is_admin: 1 }));
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows when under free plan limit (default 5)', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'free' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserTicketsThisMonth).mockReturnValue(3);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks when at free plan limit (default 5)', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'free' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserTicketsThisMonth).mockReturnValue(5);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'plan_limit_tickets' });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses custom config limit when set', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'free' }));
    vi.mocked(repo.getConfig).mockReturnValue('10');
    vi.mocked(repo.countUserTicketsThisMonth).mockReturnValue(7);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('allows unlimited for enterprise plan (default -1)', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'enterprise' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserTicketsThisMonth).mockReturnValue(999);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('falls back to free plan keys for unknown plans', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'unknown' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserTicketsThisMonth).mockReturnValue(5);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkTicketLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ── checkPipelineLimit ───────────────────────────────────────────────────────

describe('checkPipelineLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user not found', () => {
    vi.mocked(repo.findUserById).mockReturnValue(undefined);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkPipelineLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('bypasses limit for admin users', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ is_admin: 1 }));
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkPipelineLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('allows when under free pipeline limit (default 1)', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'free' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserActivePipelines).mockReturnValue(0);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkPipelineLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks when at free pipeline limit (default 1)', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'free' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserActivePipelines).mockReturnValue(1);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkPipelineLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'plan_limit_pipelines' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows pro plan with higher limit (default 3)', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'pro' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserActivePipelines).mockReturnValue(2);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkPipelineLimit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks pro plan when at limit', () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ plan: 'pro' }));
    vi.mocked(repo.getConfig).mockReturnValue(undefined);
    vi.mocked(repo.countUserActivePipelines).mockReturnValue(3);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    checkPipelineLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'plan_limit_pipelines' });
  });
});
