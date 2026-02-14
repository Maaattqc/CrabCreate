import { Request, Response } from 'express';
import { constructWebhookEvent, handleWebhookEvent } from '../services/stripe';
import logger from '../services/logger';

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  try {
    const event = constructWebhookEvent(req.body as Buffer, signature);
    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`[Stripe Webhook] Error: ${message}`);
    res.status(400).json({ error: `Webhook error: ${message}` });
  }
}
