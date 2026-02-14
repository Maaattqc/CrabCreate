import { Router, Request, Response } from 'express';
import { emitNotification, emitTicketUpdated } from '../socket';
import * as repo from '../db/repositories';
import { createTicketLimiter } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { checkTicketLimit } from '../middleware/plan-limit';
import { createTicketSchema, updateTicketSchema, reorderTicketsSchema } from '../schemas';
import { canModifyTicket, hasMinRole } from '../permissions';
import { dispatchWebhooks } from '../services/webhook-dispatcher';

const router = Router();

// GET /api/tickets -- List tickets (scoped to project)
router.get('/', (req: Request, res: Response) => {
  const filters = req.query as Record<string, string>;
  const projectId = req.project!.id;
  const tickets = repo.findAllTickets(filters, undefined, projectId);
  res.json(tickets);
});

// POST /api/tickets/reorder -- Reorder backlog tickets
router.post('/reorder', validate(reorderTicketsSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot reorder tickets' });
  }

  const { ticketIds } = req.body;
  const projectId = req.project!.id;

  repo.reorderTickets(ticketIds, projectId);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'ticket_reorder', 'ticket', 0, JSON.stringify({ ticketIds }));
  emitTicketUpdated(0, { reorder: true }, projectId);
  res.json({ success: true });
});

// GET /api/tickets/:id -- Get single ticket
router.get('/:id', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  res.json(ticket);
});

// POST /api/tickets -- Create ticket (viewers cannot create)
router.post('/', createTicketLimiter, checkTicketLimit, validate(createTicketSchema), (req: Request, res: Response) => {
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot create tickets' });
  }

  const {
    title, description, priority, template, ai_model, repo: repoName,
    assignee, target_files, tags, depends_on, due_date,
  } = req.body;

  const ticket = repo.createTicket({
    title,
    description,
    priority,
    template,
    ai_model,
    repo: repoName,
    assignee,
    target_files: JSON.stringify(target_files),
    tags: JSON.stringify(tags),
    depends_on: JSON.stringify(depends_on),
    due_date: due_date || null,
  }, req.user!.userId, req.project!.id);

  repo.insertActivity(ticket.id, `Ticket "${title}" créé`, 'create');
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'ticket_create', 'ticket', ticket.id, title);

  emitNotification(`Nouveau ticket: ${title}`, 'success', req.project!.id);
  emitTicketUpdated(ticket.id, {}, req.project!.id);
  dispatchWebhooks(req.project!.id, 'ticket:created', { ticket }).catch(() => {});
  res.status(201).json(ticket);
});

// PUT /api/tickets/:id -- Update ticket
router.put('/:id', validate(updateTicketSchema), (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const existing = repo.findTicketById(ticketId);
  if (!existing) return res.status(404).json({ error: 'Ticket not found' });
  if (existing.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(existing, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updated = repo.updateTicket(ticketId, req.body, req.user!.userId);
  if (!updated) return res.status(400).json({ error: 'No fields to update' });

  repo.insertAuditLog(req.user!.userId, req.user!.email, 'ticket_update', 'ticket', ticketId, JSON.stringify(req.body));
  emitTicketUpdated(ticketId, req.body, req.project!.id);
  dispatchWebhooks(req.project!.id, 'ticket:updated', { ticket: updated, changes: req.body }).catch(() => {});
  res.json(updated);
});

// DELETE /api/tickets/:id -- Delete ticket
router.delete('/:id', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  repo.deleteFileLocksByTicketId(ticketId);
  repo.deleteTicket(ticketId);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'ticket_delete', 'ticket', ticketId);

  emitNotification(`Ticket #${ticketId} supprimé`, 'warning', req.project!.id);
  emitTicketUpdated(ticketId, {}, req.project!.id);
  dispatchWebhooks(req.project!.id, 'ticket:deleted', { ticketId }).catch(() => {});
  res.json({ success: true });
});

// GET /api/tickets/:id/logs
router.get('/:id/logs', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) return res.status(403).json({ error: 'Access denied' });
  const logs = repo.findLogsByTicketId(ticketId);
  res.json(logs);
});

// GET /api/tickets/:id/activity
router.get('/:id/activity', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) return res.status(403).json({ error: 'Access denied' });
  const activity = repo.findActivityByTicketId(ticketId);
  res.json(activity);
});

// GET /api/tickets/:id/diff
router.get('/:id/diff', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });

  const diff = repo.findLatestDiff(ticketId);
  res.json({ diff });
});

export default router;
