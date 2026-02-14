import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { createUserWebhookSchema, updateUserWebhookSchema } from '../schemas';
import { hasMinRole } from '../permissions';

const router = Router();

// GET /api/user-webhooks
router.get('/', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const webhooks = repo.findUserWebhooksByProjectId(req.project!.id);
  res.json(webhooks);
});

// POST /api/user-webhooks
router.post('/', validate(createUserWebhookSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const webhook = repo.createUserWebhook(req.project!.id, req.body);
  res.status(201).json(webhook);
});

// PUT /api/user-webhooks/:id
router.put('/:id', validate(updateUserWebhookSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const id = Number(req.params.id);
  const existing = repo.findUserWebhookById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  const updated = repo.updateUserWebhook(id, req.body);
  res.json(updated);
});

// DELETE /api/user-webhooks/:id
router.delete('/:id', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const id = Number(req.params.id);
  const existing = repo.findUserWebhookById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  repo.deleteUserWebhook(id);
  res.json({ success: true });
});

export default router;
