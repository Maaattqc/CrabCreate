import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { createSubtaskSchema, updateSubtaskSchema } from '../schemas';
import { hasMinRole } from '../permissions';

const router = Router();

// GET /api/tickets/:ticketId/subtasks
router.get('/:ticketId/subtasks', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const subtasks = repo.findSubtasksByTicketId(ticketId);
  res.json(subtasks);
});

// POST /api/tickets/:ticketId/subtasks
router.post('/:ticketId/subtasks', validate(createSubtaskSchema), (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot create subtasks' });
  }
  const subtask = repo.createSubtask(ticketId, req.body.title);
  res.status(201).json(subtask);
});

// PUT /api/tickets/:ticketId/subtasks/:subtaskId
router.put('/:ticketId/subtasks/:subtaskId', validate(updateSubtaskSchema), (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const subtaskId = Number(req.params.subtaskId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot update subtasks' });
  }
  const existing = repo.findSubtaskById(subtaskId);
  if (!existing || existing.ticket_id !== ticketId) {
    return res.status(404).json({ error: 'Subtask not found' });
  }
  const updated = repo.updateSubtask(subtaskId, req.body);
  res.json(updated);
});

// DELETE /api/tickets/:ticketId/subtasks/:subtaskId
router.delete('/:ticketId/subtasks/:subtaskId', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const subtaskId = Number(req.params.subtaskId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot delete subtasks' });
  }
  const existing = repo.findSubtaskById(subtaskId);
  if (!existing || existing.ticket_id !== ticketId) {
    return res.status(404).json({ error: 'Subtask not found' });
  }
  repo.deleteSubtask(subtaskId);
  res.json({ success: true });
});

export default router;
