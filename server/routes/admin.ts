import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// All admin routes require admin
router.use(requireAdmin);

// Rate limit admin write operations (block, plan, admin toggle)
const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
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
router.put('/users/:id/block', adminWriteLimiter, (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = repo.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Cannot block yourself
  if (userId === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  const { blocked, reason } = req.body;
  repo.updateUserBlocked(userId, !!blocked, reason || undefined);
  repo.insertAuditLog(req.user!.userId, req.user!.email, blocked ? 'user_block' : 'user_unblock', 'user', userId, reason);
  res.json({ success: true });
});

// PUT /api/admin/users/:id/plan — change user plan
router.put('/users/:id/plan', adminWriteLimiter, (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = repo.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { plan } = req.body;
  const validPlans = ['free', 'pro', 'enterprise'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  repo.updateUserPlan(userId, plan);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'user_plan_change', 'user', userId, plan);
  res.json({ success: true });
});

// PUT /api/admin/users/:id/admin — toggle admin status
router.put('/users/:id/admin', adminWriteLimiter, (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const user = repo.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (userId === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot change your own admin status' });
  }

  const { isAdmin } = req.body;
  repo.setUserAdmin(userId, !!isAdmin);
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
  repo.deleteContactMessage(Number(req.params.id));
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
router.get('/logs', (req: Request, res: Response) => {
  const defaultLimit = parseInt(repo.getConfig('audit_log_default_limit') || '50', 10);
  const maxLimit = parseInt(repo.getConfig('audit_log_max_limit') || '200', 10);
  const limit = Math.min(Number(req.query.limit) || defaultLimit, maxLimit);
  const offset = Math.min(Math.max(Number(req.query.offset) || 0, 0), 10000);
  const category = req.query.category as string | undefined;
  // category maps to action prefix: "auth" -> login/dev_login, "ticket" -> ticket_*, "pipeline" -> pipeline_*, "admin" -> user_*
  const filterMap: Record<string, string> = {
    auth: 'login',
    ticket: 'ticket_',
    pipeline: 'pipeline_',
    admin: 'user_',
  };
  // For auth, we need to match both "login" and "dev_login"
  let actionFilter: string | undefined;
  if (category === 'auth') {
    // Special case: match login OR dev_login — use two queries
    const loginLogs = repo.findAuditLogs(limit, offset, 'login');
    const devLoginLogs = repo.findAuditLogs(limit, offset, 'dev_login');
    const allLogs = [...loginLogs, ...devLoginLogs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
    const total = repo.countAuditLogs('login') + repo.countAuditLogs('dev_login');
    res.json({ logs: allLogs, total });
    return;
  } else if (category && filterMap[category]) {
    actionFilter = filterMap[category];
  }
  const logs = repo.findAuditLogs(limit, offset, actionFilter);
  const total = repo.countAuditLogs(actionFilter);
  res.json({ logs, total });
});

export default router;
