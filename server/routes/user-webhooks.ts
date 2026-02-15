import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { createUserWebhookSchema, updateUserWebhookSchema } from '../schemas';
import { hasMinRole } from '../permissions';
import { createRateLimitStore } from '../middleware/rate-limit-store';

const router = Router();

const webhookCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  store: createRateLimitStore('webhook_create'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Webhook creation rate limited. Try again later.' },
});

function sanitizeWebhook<T extends { secret: string | null }>(webhook: T): Omit<T, 'secret'> & { secret: null; secret_configured: boolean } {
  const { secret, ...rest } = webhook;
  return { ...rest, secret: null, secret_configured: !!secret };
}

// GET /api/user-webhooks
router.get('/', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const webhooks = repo.findUserWebhooksByProjectId(req.project!.id);
  res.json(webhooks.map(sanitizeWebhook));
});

// POST /api/user-webhooks
router.post('/', webhookCreateLimiter, validate(createUserWebhookSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const maxWebhooks = parseInt(repo.getConfig('max_user_webhooks_per_project') || '20', 10);
  const existingCount = repo.countUserWebhooksByProject(req.project!.id);
  if (existingCount >= maxWebhooks) {
    return res.status(403).json({ error: 'Webhook limit reached for this project' });
  }
  const webhook = repo.createUserWebhook(req.project!.id, req.body);
  res.status(201).json(sanitizeWebhook(webhook));
});

// PUT /api/user-webhooks/:id
router.put('/:id', validate(updateUserWebhookSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid webhook id' });
  }
  const existing = repo.findUserWebhookById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  const updated = repo.updateUserWebhook(id, req.body);
  if (!updated) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  res.json(sanitizeWebhook(updated));
});

// DELETE /api/user-webhooks/:id
router.delete('/:id', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid webhook id' });
  }
  const existing = repo.findUserWebhookById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  repo.deleteUserWebhook(id);
  res.json({ success: true });
});

export default router;
