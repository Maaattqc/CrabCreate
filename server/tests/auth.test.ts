import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

// Mock config
vi.mock('../config', () => ({
  default: {
    jwtSecret: 'test-secret',
  },
}));

// Mock repositories
vi.mock('../db/repositories', () => ({
  findUserById: vi.fn(),
  getUserTokenInvalidatedAt: vi.fn().mockReturnValue(null),
}));

import jwt from 'jsonwebtoken';
import * as repo from '../db/repositories';
import { requireAuth, requireAdmin } from '../middleware/auth';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    user: undefined,
    ...overrides,
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

// ── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token in cookies', () => {
    const req = createMockReq({ cookies: {} });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no cookies at all (undefined)', () => {
    const req = createMockReq({ cookies: undefined });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid (jwt.verify throws)', () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('invalid token');
    });

    const req = createMockReq({ cookies: { crab_token: 'bad-token' } });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is valid but user not found', () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 1, email: 'ghost@example.com' } as any);
    vi.mocked(repo.findUserById).mockReturnValue(undefined);

    const req = createMockReq({ cookies: { crab_token: 'valid-token' } });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(repo.findUserById).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is blocked', () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 1, email: 'blocked@example.com' } as any);
    vi.mocked(repo.findUserById).mockReturnValue({
      id: 1,
      email: 'blocked@example.com',
      is_admin: 0,
      plan: 'free',
      blocked: 1,
      blocked_reason: 'Violation of terms',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_subscription_status: null,
      preferences: '{}',
      created_at: '2024-01-01',
      last_login_at: null,
    });

    const req = createMockReq({ cookies: { crab_token: 'valid-token' } });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Account blocked',
      reason: 'Votre compte a été suspendu. Contactez le support.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 with default reason when blocked_reason is null', () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 1, email: 'blocked2@example.com' } as any);
    vi.mocked(repo.findUserById).mockReturnValue({
      id: 1,
      email: 'blocked2@example.com',
      is_admin: 0,
      plan: 'free',
      blocked: 1,
      blocked_reason: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_subscription_status: null,
      preferences: '{}',
      created_at: '2024-01-01',
      last_login_at: null,
    });

    const req = createMockReq({ cookies: { crab_token: 'valid-token' } });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Account blocked',
      reason: 'Votre compte a été suspendu. Contactez le support.',
    });
  });

  it('calls next() and sets req.user when token and user are valid', () => {
    const payload = { userId: 1, email: 'active@example.com', iat: Math.floor(Date.now() / 1000) };
    vi.mocked(jwt.verify).mockReturnValue(payload as any);
    vi.mocked(repo.findUserById).mockReturnValue({
      id: 1,
      email: 'active@example.com',
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
    });

    const req = createMockReq({ cookies: { crab_token: 'valid-token' } });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ userId: 1, email: 'active@example.com' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('verifies jwt with the correct secret', () => {
    vi.mocked(jwt.verify).mockReturnValue({ userId: 1, email: 'test@example.com' } as any);
    vi.mocked(repo.findUserById).mockReturnValue({
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
    });

    const req = createMockReq({ cookies: { crab_token: 'my-jwt-token' } });
    const res = createMockRes();
    const next = createMockNext();

    requireAuth(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('my-jwt-token', 'test-secret', { algorithms: ['HS512'] });
  });
});

// ── requireAdmin ─────────────────────────────────────────────────────────────

describe('requireAdmin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when req.user is not set', () => {
    const req = createMockReq(); // no user
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', () => {
    vi.mocked(repo.findUserById).mockReturnValue({
      id: 2,
      email: 'regular@example.com',
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
    });

    const req = createMockReq();
    (req as any).user = { userId: 2, email: 'regular@example.com' };
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not found in DB', () => {
    vi.mocked(repo.findUserById).mockReturnValue(undefined);

    const req = createMockReq();
    (req as any).user = { userId: 999, email: 'ghost@example.com' };
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user is admin', () => {
    vi.mocked(repo.findUserById).mockReturnValue({
      id: 1,
      email: 'admin@example.com',
      is_admin: 1,
      plan: 'pro',
      blocked: 0,
      blocked_reason: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_subscription_status: null,
      preferences: '{}',
      created_at: '2024-01-01',
      last_login_at: null,
    });

    const req = createMockReq();
    (req as any).user = { userId: 1, email: 'admin@example.com' };
    const res = createMockRes();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
