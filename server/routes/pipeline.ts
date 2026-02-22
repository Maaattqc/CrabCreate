import { Router, Request, Response } from 'express';
import { emitTicketLog, emitTicketStatus, emitNotification } from '../socket';
import * as repo from '../db/repositories';
import * as fileLocker from '../services/file-locker';
import * as deployer from '../services/deployer';
import { runPipeline, resumePipeline } from '../services/pipeline-runner';
import { pipelineGuard } from '../middleware/pipeline-guard';
import { checkPipelineLimit } from '../middleware/plan-limit';
import { canLaunchPipeline, canModifyTicket } from '../permissions';
import { isTicketRepoValidForProject } from '../security/project-repo';
import logger from '../services/logger';

const PIPELINE_ACTIVE_STATUSES = new Set(['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying']);

const router = Router();

// POST /api/pipeline/launch/:id -- Launch full AI pipeline
router.post('/launch/:id', checkPipelineLimit, pipelineGuard, async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canLaunchPipeline(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!isTicketRepoValidForProject(ticket, req.project!.id)) {
    return res.status(403).json({ error: 'Ticket repository mismatch' });
  }

  // Guard: project must be configured before launching pipeline
  const project = repo.findProjectById(req.project!.id);
  if (project && !project.setup_completed) {
    return res.status(400).json({
      error: 'project_not_configured',
      message: 'Le projet doit être configuré avant de lancer la pipeline',
    });
  }

  // Guard: prevent double-launch
  if (PIPELINE_ACTIVE_STATUSES.has(ticket.status)) {
    return res.status(409).json({ error: 'Pipeline already running for this ticket' });
  }

  const projectId = req.project!.id;

  // Respond immediately, pipeline runs async
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_launch', 'ticket', ticketId);
  logger.info(`[ROUTE] POST /pipeline/launch/#${ticketId} by user=${req.user!.email}`);
  res.json({ success: true, message: 'Pipeline launched' });

  runPipeline(ticket, projectId).catch(err => {
    logger.error(`[Pipeline] Unhandled error for ticket #${ticketId}:`, err);
  });
});

// POST /api/pipeline/approve/:id
router.post('/approve/:id', async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!isTicketRepoValidForProject(ticket, req.project!.id)) {
    return res.status(403).json({ error: 'Ticket repository mismatch' });
  }

  const projectId = req.project!.id;
  const userId = req.user!.userId;
  const userEmail = req.user!.email;

  // Update UI immediately — heavy work (merge, CF deploy) runs in background
  const deployConfig = repo.findDeployConfigByProject(projectId);
  const approveFields: Record<string, any> = { pipeline_step: 8 };
  if (deployConfig?.cf_site_url) {
    // Preserve the page path from staging_url (e.g. /about.html)
    let prodUrl = deployConfig.cf_site_url;
    if (ticket.staging_url) {
      try {
        const stagingParsed = new URL(ticket.staging_url);
        if (stagingParsed.pathname && stagingParsed.pathname !== '/') {
          prodUrl = prodUrl.replace(/\/+$/, '') + stagingParsed.pathname;
        }
      } catch { /* ignore parse errors */ }
    }
    approveFields.staging_url = prodUrl;
  }

  logger.info(`[ROUTE] POST /pipeline/approve/#${ticketId} by user=${userEmail}`);
  repo.updateTicketStatus(ticket.id, 'approved', 100);
  repo.updateTicketFields(ticket.id, approveFields);
  fileLocker.unlock(ticket.id);

  repo.insertActivity(ticket.id, 'Ticket approuvé et mergé', 'approve');
  emitTicketStatus(ticket.id, 'approved', 100, projectId);
  emitNotification(`Ticket #${ticket.id} approuvé et déployé`, 'success', projectId);
  repo.insertAuditLog(userId, userEmail, 'pipeline_approve', 'ticket', ticketId);

  res.json({ success: true });

  // Background: merge PR + deploy to CF Pages production
  deployer.mergeToProduction(ticket).catch(err => {
    logger.error(`[Pipeline] Background approve deploy failed for #${ticketId}:`, err);
    emitTicketLog(ticket.id, 'Erreur déploiement production (en arrière-plan)', 'warning', 'deploying', projectId);
  });
});

// POST /api/pipeline/reject/:id
router.post('/reject/:id', async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!isTicketRepoValidForProject(ticket, req.project!.id)) {
    return res.status(403).json({ error: 'Ticket repository mismatch' });
  }

  const projectId = req.project!.id;

  // Update UI immediately — closing PR runs in background
  logger.info(`[ROUTE] POST /pipeline/reject/#${ticketId} by user=${req.user!.email}`);
  repo.updateTicketStatus(ticket.id, 'rejected', 0);
  repo.updateTicketFields(ticket.id, { pipeline_step: 0 });
  fileLocker.unlock(ticket.id);

  repo.insertActivity(ticket.id, 'Ticket rejeté', 'reject');
  emitTicketStatus(ticket.id, 'rejected', 0, projectId);
  emitNotification(`Ticket #${ticket.id} rejeté`, 'warning', projectId);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_reject', 'ticket', ticketId);

  res.json({ success: true });

  // Background: close PR on git provider
  deployer.closePR(ticket).catch(err => {
    logger.error(`[Pipeline] Background PR close failed for #${ticketId}:`, err);
  });
});

// POST /api/pipeline/retry/:id
router.post('/retry/:id', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!isTicketRepoValidForProject(ticket, req.project!.id)) {
    return res.status(403).json({ error: 'Ticket repository mismatch' });
  }

  const projectId = req.project!.id;
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_retry', 'ticket', ticketId);

  // Check if this ticket has stored coding files from a chat modification.
  // If so, resume the pipeline (review → test → deploy) instead of resetting to backlog.
  const { codingFiles } = deployer.readTicketFiles(ticketId);

  if (codingFiles.length > 0) {
    logger.info(`[ROUTE] POST /pipeline/retry/#${ticketId} — modification files found, resuming pipeline`);
    repo.insertActivity(ticket.id, 'Retry modification — reprise du pipeline', 'retry');
    res.json({ success: true, mode: 'resume' });

    resumePipeline(ticket, projectId).catch(err => {
      logger.error(`[Pipeline] Retry resume error for ticket #${ticketId}:`, err);
    });
  } else {
    logger.info(`[ROUTE] POST /pipeline/retry/#${ticketId} by user=${req.user!.email} — reset to backlog`);
    repo.updateTicketStatus(ticket.id, 'backlog', 0);
    repo.updateTicketFields(ticket.id, { pipeline_step: 0 });
    fileLocker.unlock(ticket.id);

    repo.insertActivity(ticket.id, 'Ticket remis en backlog pour retry', 'retry');
    emitTicketStatus(ticket.id, 'backlog', 0, projectId);
    res.json({ success: true, mode: 'backlog' });
  }
});

// POST /api/pipeline/rollback/:id
router.post('/rollback/:id', async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!canModifyTicket(ticket, req.user!.userId, req.project!.userRole)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!isTicketRepoValidForProject(ticket, req.project!.id)) {
    return res.status(403).json({ error: 'Ticket repository mismatch' });
  }

  const projectId = req.project!.id;

  try {
    await deployer.rollback(ticket);

    logger.info(`[ROUTE] POST /pipeline/rollback/#${ticketId} by user=${req.user!.email}`);
    repo.updateTicketStatus(ticket.id, 'rejected', 0);
    repo.updateTicketFields(ticket.id, { pipeline_step: 0 });
    repo.insertActivity(ticket.id, 'Rollback effectué', 'rollback');
    emitTicketStatus(ticket.id, 'rejected', 0, projectId);
    emitNotification(`Ticket #${ticket.id} rollback effectué`, 'warning', projectId);

    repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_rollback', 'ticket', ticketId);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('[Pipeline] Error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
});

export default router;
