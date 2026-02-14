import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { createLabelSchema, updateLabelSchema } from '../schemas';
import { hasMinRole } from '../permissions';

const router = Router();

// GET /api/labels
router.get('/', (req: Request, res: Response) => {
  const labels = repo.findLabelsByProjectId(req.project!.id);
  res.json(labels);
});

// POST /api/labels
router.post('/', validate(createLabelSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot create labels' });
  }
  const label = repo.createLabel(req.project!.id, req.body.name, req.body.color);
  res.status(201).json(label);
});

// PUT /api/labels/:id
router.put('/:id', validate(updateLabelSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot update labels' });
  }
  const id = Number(req.params.id);
  const existing = repo.findLabelById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Label not found' });
  }
  const updated = repo.updateLabel(id, req.body);
  res.json(updated);
});

// DELETE /api/labels/:id
router.delete('/:id', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Only admins can delete labels' });
  }
  const id = Number(req.params.id);
  const existing = repo.findLabelById(id);
  if (!existing || existing.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Label not found' });
  }
  repo.deleteLabel(id);
  res.json({ success: true });
});

// POST /api/labels/tickets/:ticketId/labels/:labelId
router.post('/tickets/:ticketId/labels/:labelId', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot manage labels' });
  }
  const ticketId = Number(req.params.ticketId);
  const labelId = Number(req.params.labelId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const label = repo.findLabelById(labelId);
  if (!label || label.project_id !== req.project!.id) {
    return res.status(404).json({ error: 'Label not found' });
  }
  repo.addTicketLabel(ticketId, labelId);
  const labels = repo.findLabelsByTicketId(ticketId);
  res.json(labels);
});

// DELETE /api/labels/tickets/:ticketId/labels/:labelId
router.delete('/tickets/:ticketId/labels/:labelId', (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot manage labels' });
  }
  const ticketId = Number(req.params.ticketId);
  const labelId = Number(req.params.labelId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  repo.removeTicketLabel(ticketId, labelId);
  const labels = repo.findLabelsByTicketId(ticketId);
  res.json(labels);
});

// GET /api/labels/tickets/:ticketId
router.get('/tickets/:ticketId', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const labels = repo.findLabelsByTicketId(ticketId);
  res.json(labels);
});

export default router;
