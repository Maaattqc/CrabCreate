import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { adminBlockSchema, adminPlanSchema, adminToggleSchema } from '../schemas';

const router = Router();

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// All admin routes require admin
router.use(requireAdmin);

// Rate limit admin write operations (block, plan, admin toggle)
const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  store: createRateLimitStore('admin_write'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Try again later.' },
});

// GET /api/admin/users — list all users
router.get('/users', (req: Request, res: Response) => {
  const users = repo.findAllUsers();
  const mapped = users.map(u => ({
    id: u.id,
    email: u.email,
    isAdmin: u.is_admin === 1,
    plan: u.plan || 'free',
    blocked: u.blocked === 1,
    blockedReason: u.blocked_reason,
    stripeSubscriptionStatus: u.stripe_subscription_status || null,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  }));
  res.json(mapped);
});

// PUT /api/admin/users/:id/block — block/unblock a user
router.put('/users/:id/block', adminWriteLimiter, validate(adminBlockSchema), (req: Request, res: Response) => {
  const userId = parseId(req.params.id as string);
  if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
  const user = repo.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Cannot block yourself
  if (userId === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  const { blocked, reason } = req.body;
  repo.updateUserBlocked(userId, blocked, reason || undefined);
  repo.insertAuditLog(req.user!.userId, req.user!.email, blocked ? 'user_block' : 'user_unblock', 'user', userId, reason);
  res.json({ success: true });
});

// PUT /api/admin/users/:id/plan — change user plan
router.put('/users/:id/plan', adminWriteLimiter, validate(adminPlanSchema), (req: Request, res: Response) => {
  const userId = parseId(req.params.id as string);
  if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
  const user = repo.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { plan } = req.body;
  repo.updateUserPlan(userId, plan);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'user_plan_change', 'user', userId, plan);
  res.json({ success: true });
});

// PUT /api/admin/users/:id/admin — toggle admin status
router.put('/users/:id/admin', adminWriteLimiter, validate(adminToggleSchema), (req: Request, res: Response) => {
  const userId = parseId(req.params.id as string);
  if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
  const user = repo.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (userId === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot change your own admin status' });
  }

  const { isAdmin } = req.body;
  repo.setUserAdmin(userId, isAdmin);
  repo.insertAuditLog(req.user!.userId, req.user!.email, isAdmin ? 'user_promote_admin' : 'user_demote_admin', 'user', userId);
  res.json({ success: true });
});

// GET /api/admin/contacts — list all contact messages
router.get('/contacts', (req: Request, res: Response) => {
  const messages = repo.findAllContactMessages();
  res.json(messages);
});

// DELETE /api/admin/contacts/:id — delete a contact message
router.delete('/contacts/:id', (req: Request, res: Response) => {
  const msgId = parseId(req.params.id as string);
  if (!msgId) return res.status(400).json({ error: 'Invalid ID' });
  repo.deleteContactMessage(msgId);
  res.json({ success: true });
});

// GET /api/admin/stats — global admin stats
router.get('/stats', (req: Request, res: Response) => {
  const users = repo.findAllUsers();
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.last_login_at).length;
  const blockedUsers = users.filter(u => u.blocked === 1).length;
  const planCounts = { free: 0, pro: 0, enterprise: 0 } as Record<string, number>;
  for (const u of users) {
    const plan = u.plan || 'free';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  }

  const analytics = repo.getAnalytics();

  res.json({
    totalUsers,
    activeUsers,
    blockedUsers,
    planCounts,
    totalTickets: analytics.total,
    totalCost: analytics.costTotal,
    totalTokens: analytics.tokensTotal,
  });
});

// GET /api/admin/logs — audit logs with pagination + category filter
const VALID_LOG_CATEGORIES = new Set(['auth', 'ticket', 'pipeline', 'admin', 'feedback', 'project', 'delete']);

router.get('/logs', (req: Request, res: Response) => {
  const defaultLimit = parseInt(repo.getConfig('audit_log_default_limit') || '50', 10);
  const maxLimit = parseInt(repo.getConfig('audit_log_max_limit') || '200', 10);
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : defaultLimit, maxLimit);
  const offset = Math.min(Math.max(Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0, 0), 10000);
  const rawCategory = typeof req.query.category === 'string' ? req.query.category : undefined;
  const category = rawCategory && VALID_LOG_CATEGORIES.has(rawCategory) ? rawCategory : undefined;
  // category maps to action prefix: "auth" -> login/dev_login, "ticket" -> ticket_*, "pipeline" -> pipeline_*, "admin" -> user_*, "project" -> project_*, "delete" -> *_delete
  const filterMap: Record<string, string> = {
    auth: 'login',
    ticket: 'ticket_',
    pipeline: 'pipeline_',
    admin: 'user_',
    feedback: 'onboard_feedback',
    project: 'project_',
  };
  // Multi-pattern categories (need multiple queries merged)
  const multiFilterMap: Record<string, string[]> = {
    auth: ['login', 'dev_login'],
    delete: ['ticket_delete', 'project_delete', 'comment_delete', 'contact_delete'],
  };
  let actionFilter: string | undefined;
  if (category && multiFilterMap[category]) {
    const patterns = multiFilterMap[category];
    const allLogs = patterns.flatMap(p => repo.findAuditLogs(limit, offset, p));
    allLogs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const logs = allLogs.slice(0, limit);
    const total = patterns.reduce((sum, p) => sum + repo.countAuditLogs(p), 0);
    res.json({ logs, total });
    return;
  } else if (category && filterMap[category]) {
    actionFilter = filterMap[category];
  }
  const logs = repo.findAuditLogs(limit, offset, actionFilter);
  const total = repo.countAuditLogs(actionFilter);
  res.json({ logs, total });
});

export default router;
