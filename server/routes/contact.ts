import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  email: z.string().email('Email invalide').max(255),
  message: z.string().min(1, 'Message requis').max(5000),
  website: z.string().max(0, 'Bot detected').optional(),  // honeypot field
});

// Rate limiter — window static (requires restart), limit dynamic
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: () => parseInt(repo.getConfig('contact_limit') || '3', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de messages. Réessayez plus tard.' },
});

router.post('/', contactLimiter, validate(contactSchema), (req: Request, res: Response) => {
  // Honeypot: if "website" field is filled, it's a bot
  if (req.body.website) {
    res.json({ message: 'Message envoyé avec succès.' });
    return;
  }
  const { name, email, message } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  repo.createContactMessage(name, email, message, ip);

  res.json({ message: 'Message envoyé avec succès.' });
});

export default router;
