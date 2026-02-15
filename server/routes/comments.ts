import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { validate } from '../middleware/validate';
import { createCommentSchema, updateCommentSchema, toggleReactionSchema } from '../schemas';
import { hasMinRole } from '../permissions';
import { emitTicketUpdated } from '../socket';

const router = Router();

const commentWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  store: createRateLimitStore('comments_write'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

const reactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  store: createRateLimitStore('comments_react'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reactions. Slow down.' },
});

// GET /api/comments/:ticketId -- List comments for a ticket
router.get('/:ticketId', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const comments = repo.findCommentsByTicketId(ticketId);
  // Attach reactions to each comment
  const commentIds = comments.map(c => c.id);
  const allReactions = repo.findReactionsByCommentIds(commentIds);
  const reactionsByComment = new Map<number, typeof allReactions>();
  for (const r of allReactions) {
    if (!reactionsByComment.has(r.comment_id)) reactionsByComment.set(r.comment_id, []);
    reactionsByComment.get(r.comment_id)!.push(r);
  }
  const result = comments.map(c => ({
    ...c,
    reactions: reactionsByComment.get(c.id) || [],
  }));
  res.json(result);
});

// POST /api/comments/:ticketId -- Create a comment (member+)
router.post('/:ticketId', commentWriteLimiter, validate(createCommentSchema), (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot comment' });
  }

  const { content } = req.body;
  const comment = repo.createComment(ticketId, req.user!.userId, content);

  // Parse @mentions and create notifications
  const mentionRegex = /@([\w.+-]+@[\w.-]+\.\w+)/g;
  let match: RegExpExecArray | null;
  const mentioned = new Set<string>();
  while ((match = mentionRegex.exec(content)) !== null) {
    mentioned.add(match[1].toLowerCase());
  }
  for (const email of mentioned) {
    const mentionedUser = repo.findUserByEmail(email);
    if (mentionedUser && mentionedUser.id !== req.user!.userId) {
      const ticket = repo.findTicketById(ticketId);
      repo.createNotification(
        mentionedUser.id,
        'mention',
        `Mention dans #${ticketId}`,
        `${req.user!.email} vous a mentionné : "${content.substring(0, 100)}"`,
        ticketId,
        req.project!.id,
      );
    }
  }

  // Notify watchers
  const ticket = repo.findTicketById(ticketId);
  repo.notifyWatchers(
    ticketId,
    req.user!.userId,
    'comment',
    `Nouveau commentaire sur #${ticketId}`,
    `${req.user!.email}: "${content.substring(0, 100)}"`,
    req.project!.id,
  );

  emitTicketUpdated(ticketId, { commentAdded: true }, req.project!.id);
  res.status(201).json({ ...comment, reactions: [] });
});

// PUT /api/comments/:ticketId/:commentId -- Edit a comment (own only)
router.put('/:ticketId/:commentId', validate(updateCommentSchema), (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const commentId = Number(req.params.commentId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const existing = repo.findCommentById(commentId);
  if (!existing) return res.status(404).json({ error: 'Comment not found' });
  if (existing.ticket_id !== ticketId) return res.status(404).json({ error: 'Comment not found' });
  if (existing.user_id !== req.user!.userId && !hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Cannot edit others\' comments' });
  }

  const updated = repo.updateComment(commentId, req.body.content);
  res.json(updated);
});

// DELETE /api/comments/:ticketId/:commentId -- Delete a comment
router.delete('/:ticketId/:commentId', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const commentId = Number(req.params.commentId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const existing = repo.findCommentById(commentId);
  if (!existing) return res.status(404).json({ error: 'Comment not found' });
  if (existing.ticket_id !== ticketId) return res.status(404).json({ error: 'Comment not found' });
  if (existing.user_id !== req.user!.userId && !hasMinRole(req.project!.userRole, 'admin')) {
    return res.status(403).json({ error: 'Cannot delete others\' comments' });
  }

  repo.deleteComment(commentId);
  emitTicketUpdated(ticketId, { commentDeleted: true }, req.project!.id);
  res.json({ success: true });
});

// POST /api/comments/:ticketId/:commentId/react -- Toggle reaction
router.post('/:ticketId/:commentId/react', reactionLimiter, validate(toggleReactionSchema), (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const commentId = Number(req.params.commentId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!hasMinRole(req.project!.userRole, 'member')) {
    return res.status(403).json({ error: 'Viewers cannot react' });
  }

  const comment = repo.findCommentById(commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.ticket_id !== ticketId) return res.status(404).json({ error: 'Comment not found' });

  const { emoji } = req.body;
  const result = repo.toggleReaction(commentId, req.user!.userId, emoji);
  const reactions = repo.findReactionsByCommentId(commentId);
  res.json({ ...result, reactions });
});

// GET /api/comments/:ticketId/watchers -- Get watchers for a ticket
router.get('/:ticketId/watchers', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const watchers = repo.findWatchersByTicketId(ticketId);
  const isWatching = repo.isWatching(ticketId, req.user!.userId);
  res.json({ watchers, isWatching });
});

// POST /api/comments/:ticketId/watch -- Toggle watch
router.post('/:ticketId/watch', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  if (!repo.isTicketInProject(ticketId, req.project!.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const watching = repo.isWatching(ticketId, req.user!.userId);
  if (watching) {
    repo.removeWatcher(ticketId, req.user!.userId);
  } else {
    repo.addWatcher(ticketId, req.user!.userId);
  }
  res.json({ watching: !watching });
});

export default router;
