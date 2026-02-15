import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { emitTicketLog, emitNotification } from '../socket';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import logger from '../services/logger';

const router = Router();
const WEBHOOK_REPLAY_TTL_SECONDS = 10 * 60;

function buildReplayNonce(signature: string, event: string | undefined, rawBody: Buffer, requestId: string): string {
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  return crypto
    .createHash('sha256')
    .update(`${event || 'unknown'}|${signature}|${requestId}|${bodyHash}`)
    .digest('hex');
}

// Rate limit webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  store: createRateLimitStore('webhooks_ingress'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many webhook requests.' },
});

// POST /api/webhooks/bitbucket -- Bitbucket webhook handler
router.post('/bitbucket', webhookLimiter, (req: Request, res: Response) => {
  // Signature is mandatory. Secret can come from DB config or env.
  const dbSecret = repo.getConfig('bitbucket_webhook_secret');
  const envSecret = process.env.BITBUCKET_WEBHOOK_SECRET;
  const webhookSecret = (dbSecret || envSecret || '').trim();
  if (!webhookSecret || webhookSecret.length < 16) {
    logger.security('bitbucket_webhook_secret_missing_or_weak', { path: req.path });
    res.status(503).json({ error: 'Webhook secret not configured' });
    return;
  }

  const signature = (req.headers['x-hub-signature-256'] || req.headers['x-hub-signature']) as string | undefined;
  if (!signature || !signature.startsWith('sha256=')) {
    logger.security('bitbucket_webhook_missing_signature', {
      path: req.path,
      event: req.headers['x-event-key'] || null,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    logger.security('bitbucket_webhook_missing_raw_body', {
      path: req.path,
      event: req.headers['x-event-key'] || null,
      ip: req.ip,
    });
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.security('bitbucket_webhook_signature_mismatch', {
      path: req.path,
      event: req.headers['x-event-key'] || null,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const event = req.headers['x-event-key'] as string | undefined;
  const requestIdHeader =
    (typeof req.headers['x-request-uuid'] === 'string' && req.headers['x-request-uuid']) ||
    (typeof req.headers['x-hook-uuid'] === 'string' && req.headers['x-hook-uuid']) ||
    '';
  const replayNonce = buildReplayNonce(signature, event, rawBody, requestIdHeader);
  const isFreshRequest = repo.consumeWebhookNonce('bitbucket', replayNonce, WEBHOOK_REPLAY_TTL_SECONDS);
  if (!isFreshRequest) {
    logger.security('bitbucket_webhook_replay_detected', {
      event: event || 'unknown',
      requestId: requestIdHeader || null,
      ip: req.ip,
    });
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  const payload = req.body;

  logger.info(`[Webhook] Bitbucket event: ${event}`);

  try {
    if (event === 'pullrequest:fulfilled') {
      // PR merged
      const prId = payload?.pullrequest?.id;
      if (prId) {
        const ticket = repo.findTicketByPrId(prId);
        if (ticket) {
          emitTicketLog(ticket.id, 'PR mergee via Bitbucket', 'success', 'deploying');
          repo.insertLog(ticket.id, 'PR mergee via Bitbucket', 'success', 'deploying');
          emitNotification(`PR #${prId} mergee pour ticket #${ticket.id}`, 'success', ticket.project_id ?? undefined);
        }
      }
    } else if (event === 'pullrequest:rejected') {
      // PR declined
      const prId = payload?.pullrequest?.id;
      if (prId) {
        const ticket = repo.findTicketByPrId(prId);
        if (ticket) {
          emitTicketLog(ticket.id, 'PR declinee via Bitbucket', 'warning', 'deploying');
          repo.insertLog(ticket.id, 'PR declinee via Bitbucket', 'warning', 'deploying');
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    logger.error('[Webhook] Error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
