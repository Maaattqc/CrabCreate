import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { createTicketTemplateSchema, updateTicketTemplateSchema } from '../schemas';
import { hasMinRole } from '../permissions';

const router = Router();

// GET /api/templates
router.get('/', (req: Request, res: Response) => {
  const templates = repo.findTemplatesByProjectId(req.project!.id);
  res.json(templates);
});

// POST /api/templates
router.post('/', validate(createTicketTemplateSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot create templates' });
  }
  const template = repo.createTemplate(req.project!.id, req.body);
  res.status(201).json(template);
});

// PUT /api/templates/:id
router.put('/:id', validate(updateTicketTemplateSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot update templates' });
  }
  const id = Number(req.params.id);
  const existing = repo.findTemplateById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Template not found' });
  }
  const updated = repo.updateTemplate(id, req.body);
  res.json(updated);
});

// DELETE /api/templates/:id
router.delete('/:id', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Only admins can delete templates' });
  }
  const id = Number(req.params.id);
  const existing = repo.findTemplateById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Template not found' });
  }
  repo.deleteTemplate(id);
  res.json({ success: true });
});

export default router;
