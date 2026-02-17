import { Router, Request, Response } from 'express';
import { emitNotification, emitTicketUpdated } from '../socket';
import * as repo from '../db/repositories';
import db from '../db/sqlite';
import { createTicketLimiter } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { checkTicketLimit } from '../middleware/plan-limit';
import { createTicketSchema, updateTicketSchema, reorderTicketsSchema } from '../schemas';
import { canModifyTicket, hasMinRole } from '../permissions';
import { isAllowedProjectRepoId } from '../security/project-repo';
import { dispatchWebhooks } from '../services/webhook-dispatcher';

const router = Router();

function normalizeDependsOnInput(raw: unknown): number[] | null {
  if (raw === undefined) return [];

  if (Array.isArray(raw)) {
    if (raw.every(v => Number.isInteger(v) && v > 0)) {
      return raw as number[];
    }
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every(v => Number.isInteger(v) && v > 0)) {
        return parsed as number[];
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

function validateDependenciesProject(dependsOn: number[], projectId: number, currentTicketId?: number): boolean {
  for (const depId of dependsOn) {
    if (!Number.isInteger(depId) || depId <= 0) return false;
    if (currentTicketId !== undefined && depId === currentTicketId) return false;
    const depTicket = repo.findTicketById(depId);
    if (!depTicket || depTicket.project_id !== projectId) return false;
  }
  return true;
}

function resolveProjectRepo(projectId: number, requestedRepo: unknown): string | null {
  const project = repo.findProjectById(projectId);
  if (!project || !project.default_repo) return null;

  const projectRepoId = String(project.default_repo).trim();
  if (!projectRepoId) return null;
  if (!isAllowedProjectRepoId(projectId, projectRepoId)) return null;

  if (requestedRepo === undefined || requestedRepo === null) return projectRepoId;
  if (typeof requestedRepo !== 'string') return null;

  const normalized = requestedRepo.trim();
  if (!normalized || normalized === 'main-site') return projectRepoId;
  return normalized === projectRepoId ? projectRepoId : null;
}

function stringParam(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

// GET /api/tickets -- List tickets (scoped to project)
router.get('/', (req: Request, res: Response) => {
  const filters: Record<string, string> = {};
  const q = req.query;
  if (stringParam(q.status)) filters.status = stringParam(q.status)!;
  if (stringParam(q.priority)) filters.priority = stringParam(q.priority)!;
  if (stringParam(q.template)) filters.template = stringParam(q.template)!;
  if (stringParam(q.repo)) filters.repo = stringParam(q.repo)!;
  if (stringParam(q.assignee)) filters.assignee = stringParam(q.assignee)!;
  if (stringParam(q.tag)) filters.tag = stringParam(q.tag)!;
  if (stringParam(q.search)) filters.search = stringParam(q.search)!;
  if (stringParam(q.archived)) filters.archived = stringParam(q.archived)!;
  const projectId = req.project!.id;
  const limit = Math.min(Number(req.query.limit) || 500, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const tickets = repo.findAllTickets(filters, undefined, projectId, limit, offset);
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

  const normalizedDependsOn = normalizeDependsOnInput(depends_on);
  if (!normalizedDependsOn || !validateDependenciesProject(normalizedDependsOn, req.project!.id)) {
    return res.status(400).json({ error: 'Invalid depends_on: dependencies must belong to this project' });
  }

  const resolvedRepoId = resolveProjectRepo(req.project!.id, repoName);
  if (!resolvedRepoId) {
    return res.status(400).json({ error: 'Invalid repo: ticket repo must match project default repo' });
  }
  if (!repo.findRepoById(resolvedRepoId)) {
    return res.status(400).json({ error: 'Project repository is not configured' });
  }

  // Atomic create with plan-limit re-check to prevent race conditions
  const ticketLimit = (req as Request & { _ticketLimit?: number })._ticketLimit;
  const ticket = db.transaction(() => {
    // Re-check limit inside transaction to prevent concurrent over-creation
    if (ticketLimit !== undefined) {
      const count = repo.countUserTicketsThisMonth(req.user!.userId, req.project!.id);
      if (count >= ticketLimit) return null;
    }
    return repo.createTicket({
      title,
      description,
      priority,
      template,
      ai_model,
      repo: resolvedRepoId,
      assignee,
      target_files,
      tags,
      depends_on: JSON.stringify(normalizedDependsOn),
      due_date: due_date || null,
    }, req.user!.userId, req.project!.id);
  })();

  if (!ticket) {
    return res.status(403).json({ error: 'plan_limit_tickets' });
  }

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

  if (req.body.depends_on !== undefined) {
    const normalizedDependsOn = normalizeDependsOnInput(req.body.depends_on);
    if (!normalizedDependsOn || !validateDependenciesProject(normalizedDependsOn, req.project!.id, ticketId)) {
      return res.status(400).json({ error: 'Invalid depends_on: dependencies must belong to this project' });
    }
    req.body.depends_on = normalizedDependsOn;
  }

  if (req.body.repo !== undefined) {
    const resolvedRepoId = resolveProjectRepo(req.project!.id, req.body.repo);
    if (!resolvedRepoId) {
      return res.status(400).json({ error: 'Invalid repo: ticket repo must match project default repo' });
    }
    if (!repo.findRepoById(resolvedRepoId)) {
      return res.status(400).json({ error: 'Project repository is not configured' });
    }
    req.body.repo = resolvedRepoId;
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

// POST /api/tickets/:id/archive -- Archive ticket
router.post('/:id/archive', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  repo.archiveTicket(ticketId);
  repo.insertActivity(ticketId, `Ticket #${ticketId} archivé`, 'archive');
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'ticket_archive', 'ticket', ticketId);
  emitTicketUpdated(ticketId, { archived_at: new Date().toISOString() }, req.project!.id);
  res.json({ success: true });
});

// POST /api/tickets/:id/unarchive -- Unarchive ticket
router.post('/:id/unarchive', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  repo.unarchiveTicket(ticketId);
  repo.insertActivity(ticketId, `Ticket #${ticketId} désarchivé`, 'unarchive');
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'ticket_unarchive', 'ticket', ticketId);
  emitTicketUpdated(ticketId, { archived_at: null }, req.project!.id);
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

// GET /api/tickets/:id/column-times
router.get('/:id/column-times', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) return res.status(403).json({ error: 'Access denied' });
  const times = repo.computeColumnTimes(ticketId);
  res.json(times);
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
