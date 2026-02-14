import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { emitTicketLog, emitNotification } from '../socket';
import * as repo from '../db/repositories';
import logger from '../services/logger';

const router = Router();

// Rate limit webhook endpoints
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many webhook requests.' },
});

// POST /api/webhooks/bitbucket -- Bitbucket webhook handler
router.post('/bitbucket', webhookLimiter, (req: Request, res: Response) => {
  const event = req.headers['x-event-key'] as string | undefined;
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
          emitNotification(`PR #${prId} mergee pour ticket #${ticket.id}`, 'success');
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
