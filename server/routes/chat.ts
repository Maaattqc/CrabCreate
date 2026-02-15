import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as aiCoder from '../services/ai-coder';
import { emitTicketLog, emitTicketUpdated } from '../socket';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { validate } from '../middleware/validate';
import { sendChatSchema } from '../schemas';
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
  res.json(messages);
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

    // If AI modified code, update the diff
    if (aiResponse.codeModified) {
      repo.insertLog(ticket.id, aiResponse.diff || '', 'diff', 'coding');
      emitTicketLog(ticket.id, 'Code mis à jour suite au chat', 'success', 'chat', projectId);
    }

    emitTicketUpdated(ticket.id, { chatUpdate: true }, projectId);

  } catch (err: unknown) {
    logger.error(`[Chat] Error for ticket #${ticket.id}:`, err);
    repo.insertChat(ticket.id, 'ai', 'Une erreur est survenue. Veuillez réessayer.');
    emitTicketUpdated(ticket.id, { chatUpdate: true }, projectId);
  }
});

export default router;
