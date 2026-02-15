import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { constructWebhookEvent, handleWebhookEvent } from '../services/stripe';
import logger from '../services/logger';

function logSecurity(event: string, details: Record<string, unknown>): void {
  const maybeSecurity = (logger as unknown as { security?: (ev: string, data: Record<string, unknown>) => void }).security;
  if (typeof maybeSecurity === 'function') {
    maybeSecurity(event, details);
    return;
  }
  logger.warn(`[Security] ${event}`, details);
}

export const stripeWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many webhook requests.' },
});

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    logSecurity('stripe_webhook_missing_signature', { path: req.path, ip: req.ip });
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  try {
    const event = constructWebhookEvent(req.body as Buffer, signature);
    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logSecurity('stripe_webhook_processing_error', { path: req.path, message, ip: req.ip });
    res.status(400).json({ error: 'Webhook processing failed' });
  }
}
