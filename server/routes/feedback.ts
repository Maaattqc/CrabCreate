import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { validate } from '../middleware/validate';

const router = Router();

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

// Rate limiter — 3 feedbacks per 24h per IP
const feedbackLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 3,
  store: createRateLimitStore('feedback_submit'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop d\'avis envoyés. Réessayez plus tard.' },
});

router.post('/', feedbackLimiter, validate(feedbackSchema), (req: Request, res: Response) => {
  const { rating } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.user?.userId ?? null;
  const email = req.user?.email ?? 'anonymous';

  repo.insertAuditLog(userId, email, 'onboard_feedback', 'feedback', undefined, `${rating}/5`, ip);

  res.json({ ok: true });
});

export default router;
