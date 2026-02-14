import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';

// Mock Stripe SDK — use vi.hoisted so fns are available before mock registration
const {
  mockCustomersCreate,
  mockCheckoutSessionsCreate,
  mockPortalSessionsCreate,
  mockWebhooksConstructEvent,
} = vi.hoisted(() => ({
  mockCustomersCreate: vi.fn(),
  mockCheckoutSessionsCreate: vi.fn(),
  mockPortalSessionsCreate: vi.fn(),
  mockWebhooksConstructEvent: vi.fn(),
}));

vi.mock('stripe', () => {
  function MockStripe() {
    return {
      customers: { create: mockCustomersCreate },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockPortalSessionsCreate } },
      webhooks: { constructEvent: mockWebhooksConstructEvent },
    };
  }
  return { default: MockStripe };
});

// Mock config
vi.mock('../config', () => ({
  default: {
    stripeSecretKey: 'sk_test_fake',
    stripeWebhookSecret: 'whsec_fake',
    clientUrl: 'http://localhost:5173',
  },
}));

// Mock repositories
vi.mock('../db/repositories', () => ({
  findUserById: vi.fn(),
  findUserByStripeCustomerId: vi.fn(),
  updateUserStripeCustomerId: vi.fn(),
  updateUserStripeSubscription: vi.fn(),
  updateUserPlan: vi.fn(),
  insertAuditLog: vi.fn(),
}));

// Mock logger
vi.mock('../services/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import * as repo from '../db/repositories';
import { createCheckoutSession, createPortalSession, handleWebhookEvent, constructWebhookEvent } from '../services/stripe';
import { stripeWebhookHandler } from '../routes/stripe-webhook';
import type Stripe from 'stripe';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockUser(overrides: Partial<{ id: number; stripe_customer_id: string | null; plan: string }> = {}) {
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

// ── createCheckoutSession ────────────────────────────────────────────────────

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when user not found', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(undefined);
    await expect(createCheckoutSession(1, 'test@example.com', '/success', '/cancel')).rejects.toThrow('User not found');
  });

  it('creates a new Stripe customer when none exists', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser());
    mockCustomersCreate.mockResolvedValue({ id: 'cus_new123' });
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

    const url = await createCheckoutSession(1, 'test@example.com', '/success', '/cancel');

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: { userId: '1' },
    });
    expect(repo.updateUserStripeCustomerId).toHaveBeenCalledWith(1, 'cus_new123');
    expect(url).toBe('https://checkout.stripe.com/session');
  });

  it('reuses existing Stripe customer ID', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ stripe_customer_id: 'cus_existing' }));
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

    await createCheckoutSession(1, 'test@example.com', '/success', '/cancel');

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        mode: 'subscription',
      }),
    );
  });

  it('passes correct success and cancel URLs', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ stripe_customer_id: 'cus_existing' }));
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

    await createCheckoutSession(1, 'test@example.com', '/dashboard?checkout=success', '/pricing?checkout=canceled');

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: '/dashboard?checkout=success',
        cancel_url: '/pricing?checkout=canceled',
      }),
    );
  });

  it('uses inline price_data with $49/month', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ stripe_customer_id: 'cus_existing' }));
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });

    await createCheckoutSession(1, 'test@example.com', '/success', '/cancel');

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 4900,
              recurring: { interval: 'month' },
            }),
            quantity: 1,
          }),
        ],
      }),
    );
  });
});

// ── createPortalSession ──────────────────────────────────────────────────────

describe('createPortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when user not found', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(undefined);
    await expect(createPortalSession(1)).rejects.toThrow('User not found');
  });

  it('throws when user has no Stripe customer', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser());
    await expect(createPortalSession(1)).rejects.toThrow('No Stripe customer');
  });

  it('creates portal session with correct return URL', async () => {
    vi.mocked(repo.findUserById).mockReturnValue(mockUser({ stripe_customer_id: 'cus_123' }));
    mockPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/portal' });

    const url = await createPortalSession(1);

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'http://localhost:5173/dashboard',
    });
    expect(url).toBe('https://billing.stripe.com/portal');
  });
});

// ── handleWebhookEvent ───────────────────────────────────────────────────────

describe('handleWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upgrades user to pro on checkout.session.completed', async () => {
    vi.mocked(repo.findUserByStripeCustomerId).mockReturnValue(mockUser());

    await handleWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_123',
          subscription: 'sub_456',
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserPlan).toHaveBeenCalledWith(1, 'pro');
    expect(repo.updateUserStripeSubscription).toHaveBeenCalledWith(1, 'sub_456', 'active');
    expect(repo.insertAuditLog).toHaveBeenCalled();
  });

  it('ignores checkout.session.completed for non-subscription mode', async () => {
    await handleWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'payment',
          customer: 'cus_123',
          subscription: null,
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserPlan).not.toHaveBeenCalled();
  });

  it('does not crash when user not found for checkout', async () => {
    vi.mocked(repo.findUserByStripeCustomerId).mockReturnValue(undefined);

    await handleWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_unknown',
          subscription: 'sub_456',
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserPlan).not.toHaveBeenCalled();
  });

  it('downgrades to free on subscription canceled', async () => {
    vi.mocked(repo.findUserByStripeCustomerId).mockReturnValue(mockUser({ plan: 'pro' }));

    await handleWebhookEvent({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'canceled',
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserPlan).toHaveBeenCalledWith(1, 'free');
    expect(repo.updateUserStripeSubscription).toHaveBeenCalledWith(1, 'sub_456', 'canceled');
  });

  it('downgrades to free on subscription unpaid', async () => {
    vi.mocked(repo.findUserByStripeCustomerId).mockReturnValue(mockUser({ plan: 'pro' }));

    await handleWebhookEvent({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'unpaid',
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserPlan).toHaveBeenCalledWith(1, 'free');
  });

  it('updates subscription status without downgrade on active status', async () => {
    vi.mocked(repo.findUserByStripeCustomerId).mockReturnValue(mockUser({ plan: 'pro' }));

    await handleWebhookEvent({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'active',
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserStripeSubscription).toHaveBeenCalledWith(1, 'sub_456', 'active');
    expect(repo.updateUserPlan).not.toHaveBeenCalled();
  });

  it('clears subscription on subscription.deleted', async () => {
    vi.mocked(repo.findUserByStripeCustomerId).mockReturnValue(mockUser({ plan: 'pro' }));

    await handleWebhookEvent({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_456',
          customer: 'cus_123',
          status: 'canceled',
        },
      },
    } as unknown as Stripe.Event);

    expect(repo.updateUserPlan).toHaveBeenCalledWith(1, 'free');
    expect(repo.updateUserStripeSubscription).toHaveBeenCalledWith(1, null, null);
  });
});

// ── stripeWebhookHandler ─────────────────────────────────────────────────────

describe('stripeWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = {
      headers: {},
      body: Buffer.from('{}'),
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await stripeWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing stripe-signature header' });
  });

  it('returns 400 when signature verification fails', async () => {
    mockWebhooksConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = {
      headers: { 'stripe-signature': 'bad_sig' },
      body: Buffer.from('{}'),
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await stripeWebhookHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Invalid signature') }),
    );
  });

  it('returns 200 on valid webhook event', async () => {
    mockWebhooksConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', customer: 'cus_123' } },
    });

    const req = {
      headers: { 'stripe-signature': 'valid_sig' },
      body: Buffer.from('{}'),
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await stripeWebhookHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
