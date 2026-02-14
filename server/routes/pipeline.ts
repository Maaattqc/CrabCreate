import { Router, Request, Response } from 'express';
import { emitTicketLog, emitTicketStatus, emitNotification } from '../socket';
import * as repo from '../db/repositories';
import * as dependencyChecker from '../services/dependency-checker';
import * as fileLocker from '../services/file-locker';
import * as aiCoder from '../services/ai-coder';
import * as aiReviewer from '../services/ai-reviewer';
import * as testGenerator from '../services/test-generator';
import * as deployer from '../services/deployer';
import { pipelineGuard } from '../middleware/pipeline-guard';
import { checkPipelineLimit } from '../middleware/plan-limit';
import { canLaunchPipeline, canModifyTicket } from '../permissions';
import logger from '../services/logger';

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

  // Guard: project must be configured before launching pipeline
  const project = repo.findProjectById(req.project!.id);
  if (project && !project.setup_completed) {
    return res.status(400).json({
      error: 'project_not_configured',
      message: 'Le projet doit être configuré avant de lancer la pipeline',
    });
  }

  const projectId = req.project!.id;

  // Respond immediately, pipeline runs async
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_launch', 'ticket', ticketId);
  res.json({ success: true, message: 'Pipeline launched' });

  try {
    // 1. Dependency check
    const depResult = dependencyChecker.check(ticket);
    if (!depResult.ok) {
      repo.updateTicketStatus(ticket.id, 'queued', 0);
      emitTicketStatus(ticket.id, 'queued', 0, projectId);
      emitTicketLog(ticket.id, depResult.message!, 'warning', 'dependency', projectId);
      repo.insertLog(ticket.id, depResult.message!, 'warning', 'dependency');
      return;
    }

    // 2. File lock check
    const lockResult = fileLocker.checkAndLock(ticket);
    if (!lockResult.ok) {
      repo.updateTicketStatus(ticket.id, 'queued', 0);
      emitTicketStatus(ticket.id, 'queued', 0, projectId);
      emitTicketLog(ticket.id, lockResult.message!, 'warning', 'locking', projectId);
      repo.insertLog(ticket.id, lockResult.message!, 'warning', 'locking');
      return;
    }

    // 3. Complexity estimation
    repo.updateTicketStatus(ticket.id, 'estimating', 10);
    emitTicketStatus(ticket.id, 'estimating', 10, projectId);
    emitTicketLog(ticket.id, 'Estimation de la complexité...', 'info', 'estimating', projectId);
    repo.insertLog(ticket.id, 'Estimation de la complexité...', 'info', 'estimating');

    const estimation = await aiCoder.estimateComplexity(ticket);
    repo.updateTicketFields(ticket.id, { complexity: estimation.complexity });
    emitTicketLog(ticket.id, `Complexité estimée : ${estimation.complexity}`, 'success', 'estimating', projectId);
    repo.insertLog(ticket.id, `Complexité estimée : ${estimation.complexity}`, 'success', 'estimating');
    repo.insertActivity(ticket.id, `Complexité estimée : ${estimation.complexity}`, 'estimate');

    // 4. AI Coding
    repo.updateTicketStatus(ticket.id, 'ai_coding', 25);
    emitTicketStatus(ticket.id, 'ai_coding', 25, projectId);
    emitTicketLog(ticket.id, 'Génération du code par IA...', 'info', 'coding', projectId);
    repo.insertLog(ticket.id, 'Génération du code par IA...', 'info', 'coding');

    const codingResult = await aiCoder.generateCode(ticket);

    repo.updateTicketFields(ticket.id, {
      lines_added: codingResult.linesAdded,
      lines_removed: codingResult.linesRemoved,
      tokens_used: codingResult.tokensUsed,
      cost_usd: codingResult.costUsd,
      branch_name: codingResult.branchName,
      progress: 50,
    });

    // Store diff
    if (codingResult.diff) {
      repo.insertLog(ticket.id, codingResult.diff, 'diff', 'coding');
    }

    emitTicketLog(ticket.id, `Code généré : +${codingResult.linesAdded} -${codingResult.linesRemoved} lignes`, 'success', 'coding', projectId);
    repo.insertLog(ticket.id, `Code généré : +${codingResult.linesAdded} -${codingResult.linesRemoved} lignes`, 'success', 'coding');
    repo.insertActivity(ticket.id, `Code généré par ${ticket.ai_model}`, 'ai');

    // 5. AI Review
    repo.updateTicketStatus(ticket.id, 'ai_review', 60);
    emitTicketStatus(ticket.id, 'ai_review', 60, projectId);
    emitTicketLog(ticket.id, 'Review du code par IA...', 'info', 'reviewing', projectId);
    repo.insertLog(ticket.id, 'Review du code par IA...', 'info', 'reviewing');

    const reviewResult = await aiReviewer.review(ticket, codingResult);

    repo.updateTicketFields(ticket.id, {
      ai_review_score: reviewResult.score,
      ai_review_data: JSON.stringify(reviewResult),
      progress: 70,
    });

    const reviewLogType = reviewResult.score >= 50 ? 'success' : 'error';
    emitTicketLog(ticket.id, `Review score: ${reviewResult.score}/100`, reviewLogType, 'reviewing', projectId);
    repo.insertLog(ticket.id, `Review score: ${reviewResult.score}/100`, reviewLogType, 'reviewing');
    repo.insertActivity(ticket.id, `AI Review: ${reviewResult.score}/100`, 'ai_review');

    // Auto-reject if score below threshold
    const threshold = parseInt(repo.getConfig('ai_review_threshold') || '50', 10);
    if (reviewResult.score < threshold) {
      repo.updateTicketStatus(ticket.id, 'rejected', 0);
      emitTicketStatus(ticket.id, 'rejected', 0, projectId);
      emitTicketLog(ticket.id, 'Auto-rejeté : score trop bas', 'error', 'reviewing', projectId);
      fileLocker.unlock(ticket.id);
      emitNotification(`Ticket #${ticket.id} auto-rejeté (score : ${reviewResult.score}/100)`, 'error', projectId);
      return;
    }

    // 6. Auto Tests
    const autoTestEnabled = repo.getConfig('auto_test_enabled') !== '0';
    if (autoTestEnabled) {
      repo.updateTicketStatus(ticket.id, 'testing', 75);
      emitTicketStatus(ticket.id, 'testing', 75, projectId);
      emitTicketLog(ticket.id, 'Exécution des tests...', 'info', 'testing', projectId);
      repo.insertLog(ticket.id, 'Exécution des tests...', 'info', 'testing');

      const testResults = await testGenerator.runTests(ticket, codingResult);

      repo.updateTicketFields(ticket.id, {
        test_results: JSON.stringify(testResults),
        progress: 85,
      });

      const testStatus = testResults.passed === testResults.total ? 'success' : 'warning';
      emitTicketLog(ticket.id, `Tests: ${testResults.passed}/${testResults.total} passed`, testStatus, 'testing', projectId);
      repo.insertLog(ticket.id, `Tests: ${testResults.passed}/${testResults.total} passed`, testStatus, 'testing');
      repo.insertActivity(ticket.id, `Tests: ${testResults.passed}/${testResults.total}`, 'test');
    } else {
      emitTicketLog(ticket.id, 'Tests automatiques désactivés, étape ignorée', 'warning', 'testing', projectId);
      repo.insertLog(ticket.id, 'Tests automatiques désactivés, étape ignorée', 'warning', 'testing');
      repo.updateTicketFields(ticket.id, { progress: 85 });
    }

    // 7. Deploy to staging
    const autoDeployEnabled = repo.getConfig('auto_deploy_enabled') !== '0';
    if (autoDeployEnabled) {
      repo.updateTicketStatus(ticket.id, 'deploying', 90);
      emitTicketStatus(ticket.id, 'deploying', 90, projectId);
      emitTicketLog(ticket.id, 'Déploiement...', 'info', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déploiement...', 'info', 'deploying');

      const deployResult = await deployer.deployToStaging(ticket, codingResult);

      repo.updateTicketFields(ticket.id, {
        status: 'review',
        pr_url: deployResult.prUrl,
        pr_id: deployResult.prId,
        staging_url: deployResult.stagingUrl,
        progress: 100,
      });

      emitTicketStatus(ticket.id, 'review', 100, projectId);
      emitTicketLog(ticket.id, `PR créée : ${deployResult.prUrl}`, 'success', 'deploying', projectId);
      repo.insertLog(ticket.id, `PR créée : ${deployResult.prUrl}`, 'success', 'deploying');
      repo.insertActivity(ticket.id, `Déployé - PR : ${deployResult.prUrl}`, 'push');

      emitNotification(`Ticket #${ticket.id} prêt pour review`, 'success', projectId);
    } else {
      // Skip deploy, go straight to review
      repo.updateTicketFields(ticket.id, { status: 'review', progress: 100 });
      emitTicketStatus(ticket.id, 'review', 100, projectId);
      emitTicketLog(ticket.id, 'Déploiement automatique désactivé, passage en review', 'warning', 'deploying', projectId);
      repo.insertLog(ticket.id, 'Déploiement automatique désactivé, passage en review', 'warning', 'deploying');
      emitNotification(`Ticket #${ticket.id} prêt pour review (sans déploiement)`, 'success', projectId);
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`[Pipeline] Error for ticket #${req.params.id}:`, err);
    repo.updateTicketStatus(ticket.id, 'backlog', 0);
    emitTicketStatus(ticket.id, 'backlog', 0, projectId);
    emitTicketLog(ticket.id, 'Une erreur est survenue durant le pipeline', 'error', 'error', projectId);
    repo.insertLog(ticket.id, `Erreur interne: ${message}`, 'error', 'error');
    fileLocker.unlock(ticket.id);
  }
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

  const projectId = req.project!.id;

  try {
    await deployer.mergeToProduction(ticket);

    repo.updateTicketStatus(ticket.id, 'approved', 100);
    fileLocker.unlock(ticket.id);

    repo.insertActivity(ticket.id, 'Ticket approuvé et mergé', 'approve');
    emitTicketStatus(ticket.id, 'approved', 100, projectId);
    emitNotification(`Ticket #${ticket.id} approuvé et déployé`, 'success', projectId);

    repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_approve', 'ticket', ticketId);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('[Pipeline] Error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
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

  const projectId = req.project!.id;

  try {
    await deployer.closePR(ticket);

    repo.updateTicketStatus(ticket.id, 'rejected', 0);
    fileLocker.unlock(ticket.id);

    repo.insertActivity(ticket.id, 'Ticket rejeté', 'reject');
    emitTicketStatus(ticket.id, 'rejected', 0, projectId);
    emitNotification(`Ticket #${ticket.id} rejeté`, 'warning', projectId);

    repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_reject', 'ticket', ticketId);
    res.json({ success: true });
  } catch (err: unknown) {
    logger.error('[Pipeline] Error:', err);
    res.status(500).json({ error: 'An internal error occurred' });
  }
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

  const projectId = req.project!.id;

  repo.updateTicketStatus(ticket.id, 'backlog', 0);
  fileLocker.unlock(ticket.id);

  repo.insertActivity(ticket.id, 'Ticket remis en backlog pour retry', 'retry');
  emitTicketStatus(ticket.id, 'backlog', 0, projectId);

  repo.insertAuditLog(req.user!.userId, req.user!.email, 'pipeline_retry', 'ticket', ticketId);
  res.json({ success: true });
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

  const projectId = req.project!.id;

  try {
    await deployer.rollback(ticket);

    repo.updateTicketStatus(ticket.id, 'rejected', 0);
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
