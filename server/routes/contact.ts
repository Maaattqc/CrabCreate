import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db/sqlite';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  email: z.string().email('Email invalide').max(255),
  message: z.string().min(1, 'Message requis').max(5000),
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
  const { name, email, message } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  db.prepare(
    'INSERT INTO kanban_contact_messages (name, email, message, ip) VALUES (?, ?, ?, ?)'
  ).run(name, email, message, ip);

  res.json({ message: 'Message envoyé avec succès.' });
});

export default router;
