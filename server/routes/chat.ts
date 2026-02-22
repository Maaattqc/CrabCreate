import { Router, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import * as aiCoder from '../services/ai-coder';
import { emitTicketLog, emitTicketStatus, emitTicketUpdated } from '../socket';
import * as repo from '../db/repositories';
import * as deployer from '../services/deployer';
import { resumePipeline } from '../services/pipeline-runner';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { validate } from '../middleware/validate';
import { sendChatSchema, modifyChatSchema } from '../schemas';
import { hasMinRole } from '../permissions';
import logger from '../services/logger';

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: () => parseInt(repo.getConfig('chat_messages_per_minute') || '20', 10),
  store: createRateLimitStore('chat_send'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.user?.userId ?? 'anonymous'}:${req.project?.id ?? 0}`,
  message: { error: 'Trop de messages IA. Réessayez plus tard.' },
});

// GET /api/chat/:id -- Get chat messages for a ticket (any project member)
router.get('/:id', (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) return res.status(403).json({ error: 'Access denied' });
  const messages = repo.findChatByTicketId(ticketId);
  const hasPending = deployer.hasPendingChatFiles(ticketId);
  res.json({ messages, hasPendingModification: hasPending });
});

// POST /api/chat/:id -- Send a message to the AI (member+ only)
router.post('/:id', chatLimiter, validate(sendChatSchema), async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot send messages' });
  }

  const projectId = req.project!.id;
  const { message } = req.body;

  // Save user message
  repo.insertChat(ticket.id, 'user', message);
  const previewLen = parseInt(repo.getConfig('activity_preview_length') || '50', 10);
  repo.insertActivity(ticket.id, `Message envoyé : "${message.substring(0, previewLen)}..."`, 'chat');

  // Respond immediately with user message saved
  res.json({ success: true });

  try {
    emitTicketLog(ticket.id, 'IA en train de répondre...', 'info', 'chat', projectId);

    // Get chat history
    const history = repo.findChatHistory(ticket.id);

    // Call AI with chat context
    const aiResponse = await aiCoder.chat(ticket, history, message);

    // Save AI response
    repo.insertChat(ticket.id, 'ai', aiResponse.message);

    // If AI modified code, save pending files for user confirmation
    if (aiResponse.codeModified && aiResponse.files.length > 0) {
      deployer.savePendingChatFiles(ticket.id, aiResponse.files);
      repo.insertLog(ticket.id, aiResponse.diff || '', 'diff', 'coding');
      emitTicketLog(ticket.id, 'Modifications proposées — en attente de confirmation', 'info', 'chat', projectId);
    }

    emitTicketUpdated(ticket.id, { chatUpdate: true }, projectId);

  } catch (err: unknown) {
    logger.error(`[Chat] Error for ticket #${ticket.id}:`, err);
    repo.insertChat(ticket.id, 'ai', 'Une erreur est survenue. Veuillez réessayer.');
    emitTicketUpdated(ticket.id, { chatUpdate: true }, projectId);
  }
});

// POST /api/chat/:id/modify -- Request additional AI modifications from review (member+)
router.post('/:id/modify', express.json({ limit: '4mb' }), chatLimiter, validate(modifyChatSchema), async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot request modifications' });
  }

  const projectId = req.project!.id;
  const { message, images } = req.body;

  // Save user message
  repo.insertChat(ticket.id, 'user', message);
  const previewLen = parseInt(repo.getConfig('activity_preview_length') || '50', 10);
  repo.insertActivity(ticket.id, `Modification demandée : "${message.substring(0, previewLen)}..."`, 'chat');

  // Move ticket to ai_coding immediately
  repo.updateTicketStatus(ticket.id, 'ai_coding', 50);
  emitTicketStatus(ticket.id, 'ai_coding', 50, projectId);

  res.json({ success: true });

  // Async: call AI, save files, resume pipeline
  try {
    emitTicketLog(ticket.id, 'IA en train de coder les modifications...', 'info', 'chat', projectId);

    const history = repo.findChatHistory(ticket.id);
    const aiResponse = await aiCoder.chat(ticket, history, message, images);

    repo.insertChat(ticket.id, 'ai', aiResponse.message);

    if (aiResponse.codeModified && aiResponse.files.length > 0) {
      // Merge with existing coding files
      const { codingFiles, baseFiles } = deployer.readTicketFiles(ticket.id);
      const mergedMap = new Map(codingFiles.map(f => [f.path, f]));
      for (const f of aiResponse.files) mergedMap.set(f.path, f);
      deployer.saveTicketFiles(ticket.id, Array.from(mergedMap.values()), baseFiles);

      repo.insertLog(ticket.id, aiResponse.diff || '', 'diff', 'coding');
    }

    emitTicketUpdated(ticket.id, { chatUpdate: true }, projectId);

    // Resume pipeline: ai_review → testing → deploying → review
    await resumePipeline(ticket, projectId);
  } catch (err: unknown) {
    logger.error(`[Chat-Modify] Error for ticket #${ticket.id}:`, err);
    repo.insertChat(ticket.id, 'ai', 'Une erreur est survenue. Veuillez réessayer.');
    emitTicketUpdated(ticket.id, { chatUpdate: true }, projectId);
  }
});

// POST /api/chat/:id/apply -- Apply pending chat modifications and resume pipeline (member+)
router.post('/:id/apply', async (req: Request, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.project_id !== req.project!.id) return res.status(403).json({ error: 'Access denied' });
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot apply modifications' });
  }

  if (!deployer.hasPendingChatFiles(ticketId)) {
    return res.status(400).json({ error: 'No pending modifications' });
  }

  const projectId = req.project!.id;

  // Read pending files and merge them into the coding files
  const pendingFiles = deployer.readPendingChatFiles(ticketId);
  const { codingFiles, baseFiles } = deployer.readTicketFiles(ticketId);

  // Merge: pending files override existing coding files by path
  const mergedMap = new Map(codingFiles.map(f => [f.path, f]));
  for (const pf of pendingFiles) mergedMap.set(pf.path, pf);
  const mergedFiles = Array.from(mergedMap.values());

  // Save merged files as the new coding files
  deployer.saveTicketFiles(ticketId, mergedFiles, baseFiles);
  deployer.clearPendingChatFiles(ticketId);

  logger.info(`[Chat-Apply] ticket=#${ticketId} applied ${pendingFiles.length} pending files, resuming pipeline`);

  res.json({ success: true });

  // Resume the pipeline from ai_coding → ai_review → testing → deploying → review
  resumePipeline(ticket, projectId).catch(err => {
    logger.error(`[Chat-Apply] Pipeline resume error for ticket #${ticketId}:`, err);
  });
});

export default router;
