import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { createCheckoutSession, createPortalSession } from '../services/stripe';
import logger from '../services/logger';

const router = Router();

const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: createRateLimitStore('billing_actions'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many billing requests. Try again later.' },
});

// POST /api/billing/checkout — create Stripe Checkout session for Pro plan
router.post('/checkout', billingLimiter, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = repo.findUserById(userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  if (user.plan === 'pro') {
    res.status(400).json({ error: 'Already on Pro plan' });
    return;
  }

  try {
    const baseUrl = config.nodeEnv === 'production' ? config.clientUrl : config.clientUrl;
    const url = await createCheckoutSession(
      userId,
      user.email,
      `${baseUrl}/dashboard?checkout=success`,
      `${baseUrl}/pricing?checkout=canceled`,
    );
    res.json({ url });
  } catch (err) {
    logger.error('[Billing] Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal — create Stripe Customer Portal session
router.post('/portal', billingLimiter, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const url = await createPortalSession(userId);
    res.json({ url });
  } catch (err) {
    logger.error('[Billing] Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// GET /api/billing/status — billing status for current user
router.get('/status', (req: Request, res: Response) => {
  const user = repo.findUserById(req.user!.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  res.json({
    plan: user.plan || 'free',
    stripeSubscriptionStatus: user.stripe_subscription_status || null,
    hasStripeCustomer: !!user.stripe_customer_id,
  });
});

export default router;
