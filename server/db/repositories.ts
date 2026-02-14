import db from './sqlite';
import type {
  Ticket,
  LogEntry,
  ChatMessage,
  ActivityEntry,
  ActivityWithTitle,
  FileLock,
  Repo,
  ConfigRow,
  CountResult,
  SumResult,
  AvgResult,
  StatusCount,
  PriorityCount,
  RepoCount,
  ModelCount,
  TemplateCount,
  AnalyticsResult,
  AuthUser,
  AuthCode,
  ContactMessage,
  Project,
  ProjectMember,
  ProjectMemberWithEmail,
  ProjectWithRole,
  ProjectInvitation,
  ProjectInvitationWithProject,
  ProjectRole,
  Comment,
  CommentWithUser,
  Reaction,
  ReactionWithUser,
  Watcher,
  WatcherWithEmail,
  AppNotification,
  Label,
  Subtask,
  Favorite,
  FavoriteWithTicket,
  TicketTemplate,
  UserWebhook,
  SearchResult,
  DeployConfig,
  ProjectSetupStatus,
} from '../types';

// ── Tickets ──────────────────────────────────────────────────────────────────

export function findAllTickets(filters: Record<string, string>, userId?: number, projectId?: number): Ticket[] {
  let sql = `SELECT t.*, uc.email AS creator_email, um.email AS modifier_email
    FROM kanban_tickets t
    LEFT JOIN auth_users uc ON t.user_id = uc.id
    LEFT JOIN auth_users um ON t.last_modified_by = um.id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (projectId !== undefined) {
    sql += ' AND t.project_id = ?';
    params.push(projectId);
  } else if (userId !== undefined) {
    sql += ' AND t.user_id = ?';
    params.push(userId);
  }
  if (filters.status) {
    sql += ' AND t.status = ?';
    params.push(filters.status);
  }
  if (filters.priority) {
    sql += ' AND t.priority = ?';
    params.push(filters.priority);
  }
  if (filters.template) {
    sql += ' AND t.template = ?';
    params.push(filters.template);
  }
  if (filters.repo) {
    sql += ' AND t.repo = ?';
    params.push(filters.repo);
  }
  if (filters.assignee) {
    sql += ' AND t.assignee = ?';
    params.push(filters.assignee);
  }
  if (filters.tag) {
    sql += ' AND t.tags LIKE ?';
    params.push(`%${filters.tag}%`);
  }
  if (filters.search) {
    sql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  sql += ' ORDER BY t.position ASC, t.created_at DESC';
  return db.prepare(sql).all(...params) as Ticket[];
}

export function findTicketById(id: number): Ticket | undefined {
  return db.prepare(`SELECT t.*, uc.email AS creator_email, um.email AS modifier_email
    FROM kanban_tickets t
    LEFT JOIN auth_users uc ON t.user_id = uc.id
    LEFT JOIN auth_users um ON t.last_modified_by = um.id
    WHERE t.id = ?`).get(id) as Ticket | undefined;
}

export function findTicketByPrId(prId: number): Ticket | undefined {
  return db.prepare('SELECT * FROM kanban_tickets WHERE pr_id = ?').get(prId) as Ticket | undefined;
}

export function createTicket(data: Partial<Ticket>, userId?: number, projectId?: number): Ticket {
  const result = db.prepare(`
    INSERT INTO kanban_tickets (title, description, priority, template, ai_model, repo, assignee, target_files, tags, depends_on, due_date, user_id, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.title,
    data.description || '',
    data.priority || 'medium',
    data.template || 'feature',
    data.ai_model || 'claude',
    data.repo || 'main-site',
    data.assignee || 'unassigned',
    typeof data.target_files === 'string' ? data.target_files : JSON.stringify(data.target_files || []),
    typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags || []),
    typeof data.depends_on === 'string' ? data.depends_on : JSON.stringify(data.depends_on || []),
    data.due_date || null,
    userId ?? null,
    projectId ?? null,
  );

  const ticket = db.prepare('SELECT * FROM kanban_tickets WHERE id = ?').get(result.lastInsertRowid) as Ticket;

  // Assign position so new tickets go to bottom of backlog
  const nextPos = getNextBacklogPosition(projectId ?? 0);
  db.prepare("UPDATE kanban_tickets SET position = ? WHERE id = ?").run(nextPos, ticket.id);
  ticket.position = nextPos;

  return ticket;
}

export function getNextBacklogPosition(projectId: number): number {
  const row = db.prepare(
    "SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM kanban_tickets WHERE project_id = ? AND status = 'backlog'"
  ).get(projectId) as { next_pos: number };
  return row.next_pos;
}

export function reorderTickets(ticketIds: number[], projectId: number): void {
  const stmt = db.prepare(
    "UPDATE kanban_tickets SET position = ?, updated_at = datetime('now') WHERE id = ? AND project_id = ? AND status = 'backlog'"
  );
  db.transaction(() => {
    for (let i = 0; i < ticketIds.length; i++) {
      stmt.run(i + 1, ticketIds[i], projectId);
    }
  })();
}

export function updateTicket(id: number, fields: Record<string, any>, modifiedBy?: number): Ticket | undefined {
  const allowedFields = [
    'title', 'description', 'priority', 'status', 'template', 'ai_model',
    'repo', 'assignee', 'complexity', 'target_files', 'tags', 'depends_on',
    'branch_name', 'pr_url', 'pr_id', 'staging_url', 'lines_added', 'lines_removed',
    'tokens_used', 'cost_usd', 'ai_review_score', 'ai_review_data', 'test_results', 'progress', 'position',
    'due_date',
  ];

  const updates: string[] = [];
  const values: any[] = [];

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = ?`);
      const val = fields[field];
      values.push(typeof val === 'object' ? JSON.stringify(val) : val);
    }
  }

  if (updates.length === 0) return undefined;

  updates.push("updated_at = datetime('now')");
  if (modifiedBy !== undefined) {
    updates.push('last_modified_by = ?');
    values.push(modifiedBy);
  }
  values.push(id);

  db.prepare(`UPDATE kanban_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return findTicketById(id);
}

export function deleteTicket(id: number): void {
  db.prepare('DELETE FROM kanban_tickets WHERE id = ?').run(id);
}

export function updateTicketStatus(id: number, status: string, progress: number): void {
  db.prepare("UPDATE kanban_tickets SET status = ?, progress = ?, updated_at = datetime('now') WHERE id = ?").run(status, progress, id);
}

const TICKET_UPDATABLE_FIELDS = new Set([
  'title', 'description', 'priority', 'status', 'template', 'ai_model',
  'repo', 'assignee', 'complexity', 'target_files', 'tags', 'depends_on',
  'branch_name', 'pr_url', 'pr_id', 'staging_url', 'lines_added', 'lines_removed',
  'tokens_used', 'cost_usd', 'ai_review_score', 'ai_review_data', 'test_results', 'progress',
]);

export function updateTicketFields(id: number, fields: Record<string, any>): void {
  const updates: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(fields)) {
    if (!TICKET_UPDATABLE_FIELDS.has(key)) continue;
    updates.push(`${key} = ?`);
    values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE kanban_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

export function findQueuedTickets(): Ticket[] {
  return db.prepare("SELECT * FROM kanban_tickets WHERE status = 'queued' ORDER BY priority DESC, created_at ASC").all() as Ticket[];
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export function findLogsByTicketId(ticketId: number): LogEntry[] {
  return db.prepare('SELECT * FROM kanban_logs WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as LogEntry[];
}

export function insertLog(ticketId: number, message: string, logType: string, phase: string): void {
  db.prepare('INSERT INTO kanban_logs (ticket_id, message, log_type, phase) VALUES (?, ?, ?, ?)').run(ticketId, message, logType, phase);
}

export function findLatestDiff(ticketId: number): string | null {
  const row = db.prepare(
    "SELECT message FROM kanban_logs WHERE ticket_id = ? AND phase = 'coding' AND log_type = 'diff' ORDER BY created_at DESC LIMIT 1"
  ).get(ticketId) as { message: string } | undefined;
  return row ? row.message : null;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export function findChatByTicketId(ticketId: number): ChatMessage[] {
  return db.prepare('SELECT * FROM kanban_chat WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as ChatMessage[];
}

export function findChatHistory(ticketId: number): { role: string; message: string }[] {
  return db.prepare('SELECT role, message FROM kanban_chat WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId) as { role: string; message: string }[];
}

export function insertChat(ticketId: number, role: string, message: string): void {
  db.prepare('INSERT INTO kanban_chat (ticket_id, role, message) VALUES (?, ?, ?)').run(ticketId, role, message);
}

// ── Activity ─────────────────────────────────────────────────────────────────

export function findActivityByTicketId(ticketId: number): ActivityEntry[] {
  return db.prepare('SELECT * FROM kanban_activity WHERE ticket_id = ? ORDER BY created_at DESC').all(ticketId) as ActivityEntry[];
}

export function insertActivity(ticketId: number, message: string, activityType: string): void {
  db.prepare('INSERT INTO kanban_activity (ticket_id, message, activity_type) VALUES (?, ?, ?)').run(ticketId, message, activityType);
}

// ── File Locks ───────────────────────────────────────────────────────────────

export function findAllFileLocks(): FileLock[] {
  return db.prepare(`
    SELECT fl.*, t.title as ticket_title
    FROM kanban_file_locks fl
    LEFT JOIN kanban_tickets t ON fl.ticket_id = t.id
  `).all() as FileLock[];
}

export function findFileLockConflict(filePath: string, excludeTicketId: number): FileLock | undefined {
  return db.prepare(
    'SELECT * FROM kanban_file_locks WHERE file_path = ? AND ticket_id != ?'
  ).get(filePath, excludeTicketId) as FileLock | undefined;
}

export function insertFileLock(filePath: string, ticketId: number): void {
  db.prepare('INSERT INTO kanban_file_locks (file_path, ticket_id) VALUES (?, ?)').run(filePath, ticketId);
}

export function deleteFileLocksByTicketId(ticketId: number): void {
  db.prepare('DELETE FROM kanban_file_locks WHERE ticket_id = ?').run(ticketId);
}

// ── Config ───────────────────────────────────────────────────────────────────

export function getConfig(key: string): string | undefined {
  const row = db.prepare('SELECT config_value FROM kanban_config WHERE config_key = ?').get(key) as ConfigRow | undefined;
  return row ? row.config_value : undefined;
}

export function setConfig(key: string, value: string): void {
  db.prepare(`
    INSERT INTO kanban_config (config_key, config_value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(config_key) DO UPDATE SET config_value = ?, updated_at = datetime('now')
  `).run(key, value, value);
}

// ── Repos ────────────────────────────────────────────────────────────────────

export function findAllRepos(): Repo[] {
  return db.prepare('SELECT * FROM kanban_repos').all() as Repo[];
}

export function findRepoById(id: string): Repo | undefined {
  return db.prepare('SELECT * FROM kanban_repos WHERE id = ?').get(id) as Repo | undefined;
}

// ── Analytics ────────────────────────────────────────────────────────────────

export function getAnalytics(): AnalyticsResult {
  const total = (db.prepare('SELECT COUNT(*) as count FROM kanban_tickets').get() as CountResult).count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM kanban_tickets GROUP BY status').all() as StatusCount[];
  const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM kanban_tickets GROUP BY priority').all() as PriorityCount[];
  const byRepo = db.prepare('SELECT repo, COUNT(*) as count FROM kanban_tickets GROUP BY repo').all() as RepoCount[];
  const byModel = db.prepare('SELECT ai_model, COUNT(*) as count FROM kanban_tickets GROUP BY ai_model').all() as ModelCount[];
  const byTemplate = db.prepare('SELECT template, COUNT(*) as count FROM kanban_tickets GROUP BY template').all() as TemplateCount[];

  const tokensTotal = (db.prepare('SELECT COALESCE(SUM(tokens_used), 0) as total FROM kanban_tickets').get() as SumResult).total;
  const costTotal = (db.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM kanban_tickets').get() as SumResult).total;
  const linesAdded = (db.prepare('SELECT COALESCE(SUM(lines_added), 0) as total FROM kanban_tickets').get() as SumResult).total;
  const linesRemoved = (db.prepare('SELECT COALESCE(SUM(lines_removed), 0) as total FROM kanban_tickets').get() as SumResult).total;

  const avgScore = (db.prepare('SELECT COALESCE(AVG(ai_review_score), 0) as avg FROM kanban_tickets WHERE ai_review_score IS NOT NULL').get() as AvgResult).avg;

  const approved = (db.prepare("SELECT COUNT(*) as count FROM kanban_tickets WHERE status = 'approved'").get() as CountResult).count;
  const rejected = (db.prepare("SELECT COUNT(*) as count FROM kanban_tickets WHERE status = 'rejected'").get() as CountResult).count;
  const approvalRate = (approved + rejected) > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;

  const fileLocks = (db.prepare('SELECT COUNT(*) as count FROM kanban_file_locks').get() as CountResult).count;

  const recentActivity = db.prepare(
    'SELECT a.*, t.title as ticket_title FROM kanban_activity a LEFT JOIN kanban_tickets t ON a.ticket_id = t.id ORDER BY a.created_at DESC LIMIT 20'
  ).all() as ActivityWithTitle[];

  // Most modified files (from target_files)
  const tickets = db.prepare("SELECT target_files FROM kanban_tickets WHERE target_files IS NOT NULL AND target_files != '[]'").all() as Pick<Ticket, 'target_files'>[];
  const fileCounts: Record<string, number> = {};
  for (const t of tickets) {
    try {
      const files = JSON.parse(t.target_files || '[]') as string[];
      for (const f of files) {
        fileCounts[f] = (fileCounts[f] || 0) + 1;
      }
    } catch (_) {
      // Skip unparseable entries
    }
  }
  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  return {
    total,
    byStatus,
    byPriority,
    byRepo,
    byModel,
    byTemplate,
    tokensTotal,
    costTotal: Math.round(costTotal * 100) / 100,
    linesAdded,
    linesRemoved,
    avgScore: Math.round(avgScore),
    approvalRate,
    approved,
    rejected,
    fileLocks,
    recentActivity,
    topFiles,
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function findUserByEmail(email: string): AuthUser | undefined {
  return db.prepare('SELECT * FROM auth_users WHERE email = ?').get(email) as AuthUser | undefined;
}

export function findUserById(id: number): AuthUser | undefined {
  return db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id) as AuthUser | undefined;
}

export function createUser(email: string): AuthUser {
  const result = db.prepare('INSERT INTO auth_users (email) VALUES (?)').run(email);
  return db.prepare('SELECT * FROM auth_users WHERE id = ?').get(result.lastInsertRowid) as AuthUser;
}

export function updateUserLastLogin(id: number): void {
  db.prepare("UPDATE auth_users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

export function createAuthCode(email: string, code: string, expiresAt: string): AuthCode {
  const result = db.prepare('INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);
  return db.prepare('SELECT * FROM auth_codes WHERE id = ?').get(result.lastInsertRowid) as AuthCode;
}

export function findValidAuthCode(email: string, code: string): AuthCode | undefined {
  return db.prepare(
    "SELECT * FROM auth_codes WHERE email = ? AND code = ? AND used = 0 AND attempts < 5 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
  ).get(email, code) as AuthCode | undefined;
}

export function incrementAuthCodeAttempts(id: number): void {
  db.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = ?').run(id);
}

export function markAuthCodeUsed(id: number): void {
  db.prepare('UPDATE auth_codes SET used = 1 WHERE id = ?').run(id);
}

export function invalidateAuthCodes(email: string): void {
  db.prepare('UPDATE auth_codes SET used = 1 WHERE email = ? AND used = 0').run(email);
}

export function countRecentAuthCodes(email: string, sinceMinutes: number): number {
  const result = db.prepare(
    "SELECT COUNT(*) as count FROM auth_codes WHERE email = ? AND created_at > datetime('now', ?)"
  ).get(email, `-${sinceMinutes} minutes`) as CountResult;
  return result.count;
}

export function findLatestAuthCode(email: string): AuthCode | undefined {
  return db.prepare(
    "SELECT * FROM auth_codes WHERE email = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
  ).get(email) as AuthCode | undefined;
}

export function updateUserPreferences(id: number, preferences: string): void {
  db.prepare('UPDATE auth_users SET preferences = ? WHERE id = ?').run(preferences, id);
}

export function setUserAdmin(id: number, isAdmin: boolean): void {
  db.prepare('UPDATE auth_users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id);
}

export function countUsers(): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM auth_users').get() as CountResult;
  return row.count;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export function findAllUsers(): AuthUser[] {
  return db.prepare('SELECT * FROM auth_users ORDER BY created_at DESC').all() as AuthUser[];
}

export function updateUserBlocked(id: number, blocked: boolean, reason?: string): void {
  db.prepare('UPDATE auth_users SET blocked = ?, blocked_reason = ? WHERE id = ?').run(blocked ? 1 : 0, reason || null, id);
}

export function updateUserPlan(id: number, plan: string): void {
  db.prepare('UPDATE auth_users SET plan = ? WHERE id = ?').run(plan, id);
}

export function updateUserStripeCustomerId(id: number, stripeCustomerId: string): void {
  db.prepare('UPDATE auth_users SET stripe_customer_id = ? WHERE id = ?').run(stripeCustomerId, id);
}

export function updateUserStripeSubscription(id: number, subscriptionId: string | null, subscriptionStatus: string | null): void {
  db.prepare('UPDATE auth_users SET stripe_subscription_id = ?, stripe_subscription_status = ? WHERE id = ?').run(subscriptionId, subscriptionStatus, id);
}

export function findUserByStripeCustomerId(stripeCustomerId: string): AuthUser | undefined {
  return db.prepare('SELECT * FROM auth_users WHERE stripe_customer_id = ?').get(stripeCustomerId) as AuthUser | undefined;
}

export function countUserTicketsThisMonth(userId: number, projectId: number): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM kanban_tickets WHERE user_id = ? AND project_id = ? AND created_at >= datetime('now', 'start of month')"
  ).get(userId, projectId) as CountResult;
  return row.count;
}

export function countUserActivePipelines(userId: number, projectId: number): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM kanban_tickets WHERE user_id = ? AND project_id = ? AND status IN ('estimating', 'ai_coding', 'ai_review', 'testing', 'deploying')"
  ).get(userId, projectId) as CountResult;
  return row.count;
}

export function findAllContactMessages(): ContactMessage[] {
  return db.prepare('SELECT * FROM kanban_contact_messages ORDER BY created_at DESC').all() as ContactMessage[];
}

export function deleteContactMessage(id: number): void {
  db.prepare('DELETE FROM kanban_contact_messages WHERE id = ?').run(id);
}

export function getAnalyticsForUser(userId: number): AnalyticsResult {
  const total = (db.prepare('SELECT COUNT(*) as count FROM kanban_tickets WHERE user_id = ?').get(userId) as CountResult).count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM kanban_tickets WHERE user_id = ? GROUP BY status').all(userId) as StatusCount[];
  const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM kanban_tickets WHERE user_id = ? GROUP BY priority').all(userId) as PriorityCount[];
  const byRepo = db.prepare('SELECT repo, COUNT(*) as count FROM kanban_tickets WHERE user_id = ? GROUP BY repo').all(userId) as RepoCount[];
  const byModel = db.prepare('SELECT ai_model, COUNT(*) as count FROM kanban_tickets WHERE user_id = ? GROUP BY ai_model').all(userId) as ModelCount[];
  const byTemplate = db.prepare('SELECT template, COUNT(*) as count FROM kanban_tickets WHERE user_id = ? GROUP BY template').all(userId) as TemplateCount[];

  const tokensTotal = (db.prepare('SELECT COALESCE(SUM(tokens_used), 0) as total FROM kanban_tickets WHERE user_id = ?').get(userId) as SumResult).total;
  const costTotal = (db.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM kanban_tickets WHERE user_id = ?').get(userId) as SumResult).total;
  const linesAdded = (db.prepare('SELECT COALESCE(SUM(lines_added), 0) as total FROM kanban_tickets WHERE user_id = ?').get(userId) as SumResult).total;
  const linesRemoved = (db.prepare('SELECT COALESCE(SUM(lines_removed), 0) as total FROM kanban_tickets WHERE user_id = ?').get(userId) as SumResult).total;

  const avgScore = (db.prepare('SELECT COALESCE(AVG(ai_review_score), 0) as avg FROM kanban_tickets WHERE user_id = ? AND ai_review_score IS NOT NULL').get(userId) as AvgResult).avg;

  const approved = (db.prepare("SELECT COUNT(*) as count FROM kanban_tickets WHERE user_id = ? AND status = 'approved'").get(userId) as CountResult).count;
  const rejected = (db.prepare("SELECT COUNT(*) as count FROM kanban_tickets WHERE user_id = ? AND status = 'rejected'").get(userId) as CountResult).count;
  const approvalRate = (approved + rejected) > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;

  const fileLocks = (db.prepare('SELECT COUNT(*) as count FROM kanban_file_locks fl INNER JOIN kanban_tickets t ON fl.ticket_id = t.id WHERE t.user_id = ?').get(userId) as CountResult).count;

  const recentActivity = db.prepare(
    'SELECT a.*, t.title as ticket_title FROM kanban_activity a LEFT JOIN kanban_tickets t ON a.ticket_id = t.id WHERE t.user_id = ? ORDER BY a.created_at DESC LIMIT 20'
  ).all(userId) as ActivityWithTitle[];

  const tickets = db.prepare("SELECT target_files FROM kanban_tickets WHERE user_id = ? AND target_files IS NOT NULL AND target_files != '[]'").all(userId) as Pick<Ticket, 'target_files'>[];
  const fileCounts: Record<string, number> = {};
  for (const t of tickets) {
    try {
      const files = JSON.parse(t.target_files || '[]') as string[];
      for (const f of files) {
        fileCounts[f] = (fileCounts[f] || 0) + 1;
      }
    } catch (_) {
      // Skip unparseable entries
    }
  }
  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  return {
    total,
    byStatus,
    byPriority,
    byRepo,
    byModel,
    byTemplate,
    tokensTotal,
    costTotal: Math.round(costTotal * 100) / 100,
    linesAdded,
    linesRemoved,
    avgScore: Math.round(avgScore),
    approvalRate,
    approved,
    rejected,
    fileLocks,
    recentActivity,
    topFiles,
  };
}

// Check if a ticket belongs to a user (or user is admin)
export function isTicketOwner(ticketId: number, userId: number): boolean {
  const ticket = findTicketById(ticketId);
  if (!ticket) return false;
  return ticket.user_id === userId;
}

export function isUserAdmin(userId: number): boolean {
  const user = findUserById(userId);
  return user?.is_admin === 1;
}

// ── Projects ────────────────────────────────────────────────────────────────

export function createProject(name: string, description: string, slug: string, ownerId: number, isPrivate: number, defaultRepo: string): Project {
  const result = db.prepare(
    "INSERT INTO kanban_projects (name, description, slug, owner_id, is_private, default_repo) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(name, description, slug, ownerId, isPrivate, defaultRepo);
  // Also insert owner as member
  db.prepare(
    "INSERT INTO kanban_project_members (project_id, user_id, role) VALUES (?, ?, 'owner')"
  ).run(result.lastInsertRowid, ownerId);
  return db.prepare('SELECT * FROM kanban_projects WHERE id = ?').get(result.lastInsertRowid) as Project;
}

export function findProjectById(id: number): Project | undefined {
  return db.prepare('SELECT * FROM kanban_projects WHERE id = ?').get(id) as Project | undefined;
}

export function findProjectsByUserId(userId: number): ProjectWithRole[] {
  return db.prepare(`
    SELECT p.*, pm.role
    FROM kanban_projects p
    INNER JOIN kanban_project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ?
    ORDER BY p.updated_at DESC
  `).all(userId) as ProjectWithRole[];
}

export function updateProject(id: number, fields: Partial<Pick<Project, 'name' | 'description' | 'is_private' | 'default_repo' | 'cursors_enabled' | 'presence_enabled' | 'presence_max_visible'>>): Project | undefined {
  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (fields.name !== undefined) { updates.push('name = ?'); values.push(fields.name); }
  if (fields.description !== undefined) { updates.push('description = ?'); values.push(fields.description); }
  if (fields.is_private !== undefined) { updates.push('is_private = ?'); values.push(fields.is_private); }
  if (fields.default_repo !== undefined) { updates.push('default_repo = ?'); values.push(fields.default_repo); }
  if (fields.cursors_enabled !== undefined) { updates.push('cursors_enabled = ?'); values.push(fields.cursors_enabled); }
  if (fields.presence_enabled !== undefined) { updates.push('presence_enabled = ?'); values.push(fields.presence_enabled); }
  if (fields.presence_max_visible !== undefined) { updates.push('presence_max_visible = ?'); values.push(fields.presence_max_visible); }

  if (updates.length === 0) return undefined;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE kanban_projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM kanban_projects WHERE id = ?').get(id) as Project | undefined;
}

export function deleteProject(id: number): void {
  // Tickets cascade handled by tickets having project_id (we delete them explicitly for cleanup)
  db.prepare('DELETE FROM kanban_file_locks WHERE ticket_id IN (SELECT id FROM kanban_tickets WHERE project_id = ?)').run(id);
  db.prepare('DELETE FROM kanban_tickets WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM kanban_projects WHERE id = ?').run(id);
}

export function findProjectByOwnerAndSlug(ownerId: number, slug: string): Project | undefined {
  return db.prepare('SELECT * FROM kanban_projects WHERE owner_id = ? AND slug = ?').get(ownerId, slug) as Project | undefined;
}

// ── Project Members ─────────────────────────────────────────────────────────

export function findProjectMember(projectId: number, userId: number): ProjectMember | undefined {
  return db.prepare('SELECT * FROM kanban_project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId) as ProjectMember | undefined;
}

export function findProjectMembers(projectId: number): ProjectMemberWithEmail[] {
  return db.prepare(`
    SELECT pm.*, u.email
    FROM kanban_project_members pm
    INNER JOIN auth_users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY pm.role ASC, pm.joined_at ASC
  `).all(projectId) as ProjectMemberWithEmail[];
}

export function insertProjectMember(projectId: number, userId: number, role: ProjectRole): ProjectMember {
  const result = db.prepare(
    "INSERT INTO kanban_project_members (project_id, user_id, role) VALUES (?, ?, ?)"
  ).run(projectId, userId, role);
  return db.prepare('SELECT * FROM kanban_project_members WHERE id = ?').get(result.lastInsertRowid) as ProjectMember;
}

export function updateProjectMemberRole(projectId: number, userId: number, role: ProjectRole): void {
  db.prepare('UPDATE kanban_project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(role, projectId, userId);
}

export function deleteProjectMember(projectId: number, userId: number): void {
  db.prepare('DELETE FROM kanban_project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
}

export function countProjectMembers(projectId: number): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM kanban_project_members WHERE project_id = ?').get(projectId) as CountResult;
  return row.count;
}

export function countUserOwnedProjects(userId: number): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM kanban_projects WHERE owner_id = ?').get(userId) as CountResult;
  return row.count;
}

// ── Project Invitations ─────────────────────────────────────────────────────

export function createInvitation(projectId: number, email: string, role: ProjectRole, invitedBy: number, token: string, expiresAt: string): ProjectInvitation {
  const result = db.prepare(
    "INSERT INTO kanban_project_invitations (project_id, email, role, invited_by, token, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(projectId, email, role, invitedBy, token, expiresAt);
  return db.prepare('SELECT * FROM kanban_project_invitations WHERE id = ?').get(result.lastInsertRowid) as ProjectInvitation;
}

export function findInvitationByToken(token: string): ProjectInvitation | undefined {
  return db.prepare('SELECT * FROM kanban_project_invitations WHERE token = ?').get(token) as ProjectInvitation | undefined;
}

export function findPendingInvitationsByEmail(email: string): ProjectInvitationWithProject[] {
  return db.prepare(`
    SELECT i.*, p.name as project_name, u.email as inviter_email
    FROM kanban_project_invitations i
    INNER JOIN kanban_projects p ON i.project_id = p.id
    INNER JOIN auth_users u ON i.invited_by = u.id
    WHERE i.email = ? AND i.status = 'pending' AND i.expires_at > datetime('now')
    ORDER BY i.created_at DESC
  `).all(email) as ProjectInvitationWithProject[];
}

export function findPendingInvitationsByProject(projectId: number): ProjectInvitation[] {
  return db.prepare(
    "SELECT * FROM kanban_project_invitations WHERE project_id = ? AND status = 'pending' AND expires_at > datetime('now') ORDER BY created_at DESC"
  ).all(projectId) as ProjectInvitation[];
}

export function updateInvitationStatus(id: number, status: string): void {
  db.prepare('UPDATE kanban_project_invitations SET status = ? WHERE id = ?').run(status, id);
}

export function deleteInvitation(id: number): void {
  db.prepare('DELETE FROM kanban_project_invitations WHERE id = ?').run(id);
}

export function findExistingInvitation(projectId: number, email: string): ProjectInvitation | undefined {
  return db.prepare(
    "SELECT * FROM kanban_project_invitations WHERE project_id = ? AND email = ? AND status = 'pending' AND expires_at > datetime('now')"
  ).get(projectId, email) as ProjectInvitation | undefined;
}

export function isTicketInProject(ticketId: number, projectId: number): boolean {
  const ticket = findTicketById(ticketId);
  if (!ticket) return false;
  return ticket.project_id === projectId;
}

// ── Analytics (project-scoped) ──────────────────────────────────────────────

export function getAnalyticsForProject(projectId: number): AnalyticsResult {
  const total = (db.prepare('SELECT COUNT(*) as count FROM kanban_tickets WHERE project_id = ?').get(projectId) as CountResult).count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM kanban_tickets WHERE project_id = ? GROUP BY status').all(projectId) as StatusCount[];
  const byPriority = db.prepare('SELECT priority, COUNT(*) as count FROM kanban_tickets WHERE project_id = ? GROUP BY priority').all(projectId) as PriorityCount[];
  const byRepo = db.prepare('SELECT repo, COUNT(*) as count FROM kanban_tickets WHERE project_id = ? GROUP BY repo').all(projectId) as RepoCount[];
  const byModel = db.prepare('SELECT ai_model, COUNT(*) as count FROM kanban_tickets WHERE project_id = ? GROUP BY ai_model').all(projectId) as ModelCount[];
  const byTemplate = db.prepare('SELECT template, COUNT(*) as count FROM kanban_tickets WHERE project_id = ? GROUP BY template').all(projectId) as TemplateCount[];

  const tokensTotal = (db.prepare('SELECT COALESCE(SUM(tokens_used), 0) as total FROM kanban_tickets WHERE project_id = ?').get(projectId) as SumResult).total;
  const costTotal = (db.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM kanban_tickets WHERE project_id = ?').get(projectId) as SumResult).total;
  const linesAdded = (db.prepare('SELECT COALESCE(SUM(lines_added), 0) as total FROM kanban_tickets WHERE project_id = ?').get(projectId) as SumResult).total;
  const linesRemoved = (db.prepare('SELECT COALESCE(SUM(lines_removed), 0) as total FROM kanban_tickets WHERE project_id = ?').get(projectId) as SumResult).total;

  const avgScore = (db.prepare('SELECT COALESCE(AVG(ai_review_score), 0) as avg FROM kanban_tickets WHERE project_id = ? AND ai_review_score IS NOT NULL').get(projectId) as AvgResult).avg;

  const approved = (db.prepare("SELECT COUNT(*) as count FROM kanban_tickets WHERE project_id = ? AND status = 'approved'").get(projectId) as CountResult).count;
  const rejected = (db.prepare("SELECT COUNT(*) as count FROM kanban_tickets WHERE project_id = ? AND status = 'rejected'").get(projectId) as CountResult).count;
  const approvalRate = (approved + rejected) > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0;

  const fileLocks = (db.prepare('SELECT COUNT(*) as count FROM kanban_file_locks fl INNER JOIN kanban_tickets t ON fl.ticket_id = t.id WHERE t.project_id = ?').get(projectId) as CountResult).count;

  const recentActivity = db.prepare(
    'SELECT a.*, t.title as ticket_title FROM kanban_activity a LEFT JOIN kanban_tickets t ON a.ticket_id = t.id WHERE t.project_id = ? ORDER BY a.created_at DESC LIMIT 20'
  ).all(projectId) as ActivityWithTitle[];

  const tickets = db.prepare("SELECT target_files FROM kanban_tickets WHERE project_id = ? AND target_files IS NOT NULL AND target_files != '[]'").all(projectId) as Pick<Ticket, 'target_files'>[];
  const fileCounts: Record<string, number> = {};
  for (const t of tickets) {
    try {
      const files = JSON.parse(t.target_files || '[]') as string[];
      for (const f of files) {
        fileCounts[f] = (fileCounts[f] || 0) + 1;
      }
    } catch (_) {
      // Skip unparseable entries
    }
  }
  const topFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  return {
    total,
    byStatus,
    byPriority,
    byRepo,
    byModel,
    byTemplate,
    tokensTotal,
    costTotal: Math.round(costTotal * 100) / 100,
    linesAdded,
    linesRemoved,
    avgScore: Math.round(avgScore),
    approvalRate,
    approved,
    rejected,
    fileLocks,
    recentActivity,
    topFiles,
  };
}

export function findFileLocksForProject(projectId: number): FileLock[] {
  return db.prepare(`
    SELECT fl.*, t.title as ticket_title
    FROM kanban_file_locks fl
    LEFT JOIN kanban_tickets t ON fl.ticket_id = t.id
    WHERE t.project_id = ?
  `).all(projectId) as FileLock[];
}

// ── Audit Logs ──────────────────────────────────────────────────────────────

export function insertAuditLog(userId: number | null, userEmail: string, action: string, entityType?: string, entityId?: number, details?: string, ip?: string): void {
  db.prepare(
    'INSERT INTO kanban_audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, userEmail, action, entityType || null, entityId || null, details || null, ip || null);
}

export function findAuditLogs(limit = 200, offset = 0, actionFilter?: string): any[] {
  if (actionFilter) {
    const pattern = actionFilter + '%';
    return db.prepare(
      'SELECT * FROM kanban_audit_logs WHERE action LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(pattern, limit, offset) as any[];
  }
  return db.prepare(
    'SELECT * FROM kanban_audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as any[];
}

export function countAuditLogs(actionFilter?: string): number {
  if (actionFilter) {
    const pattern = actionFilter + '%';
    const row = db.prepare('SELECT COUNT(*) as count FROM kanban_audit_logs WHERE action LIKE ?').get(pattern) as { count: number };
    return row.count;
  }
  const row = db.prepare('SELECT COUNT(*) as count FROM kanban_audit_logs').get() as { count: number };
  return row.count;
}

// ── Comments ────────────────────────────────────────────────────────────────

export function findCommentsByTicketId(ticketId: number): CommentWithUser[] {
  return db.prepare(`
    SELECT c.*, u.email
    FROM kanban_comments c
    INNER JOIN auth_users u ON c.user_id = u.id
    WHERE c.ticket_id = ?
    ORDER BY c.created_at ASC
  `).all(ticketId) as CommentWithUser[];
}

export function findCommentById(id: number): Comment | undefined {
  return db.prepare('SELECT * FROM kanban_comments WHERE id = ?').get(id) as Comment | undefined;
}

export function createComment(ticketId: number, userId: number, content: string): CommentWithUser {
  const result = db.prepare(
    'INSERT INTO kanban_comments (ticket_id, user_id, content) VALUES (?, ?, ?)'
  ).run(ticketId, userId, content);
  return db.prepare(`
    SELECT c.*, u.email
    FROM kanban_comments c
    INNER JOIN auth_users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid) as CommentWithUser;
}

export function updateComment(id: number, content: string): CommentWithUser | undefined {
  db.prepare("UPDATE kanban_comments SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
  return db.prepare(`
    SELECT c.*, u.email
    FROM kanban_comments c
    INNER JOIN auth_users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(id) as CommentWithUser | undefined;
}

export function deleteComment(id: number): void {
  db.prepare('DELETE FROM kanban_comments WHERE id = ?').run(id);
}

// ── Reactions ────────────────────────────────────────────────────────────────

export function findReactionsByCommentId(commentId: number): ReactionWithUser[] {
  return db.prepare(`
    SELECT r.*, u.email
    FROM kanban_reactions r
    INNER JOIN auth_users u ON r.user_id = u.id
    WHERE r.comment_id = ?
    ORDER BY r.created_at ASC
  `).all(commentId) as ReactionWithUser[];
}

export function findReactionsByCommentIds(commentIds: number[]): ReactionWithUser[] {
  if (commentIds.length === 0) return [];
  const placeholders = commentIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT r.*, u.email
    FROM kanban_reactions r
    INNER JOIN auth_users u ON r.user_id = u.id
    WHERE r.comment_id IN (${placeholders})
    ORDER BY r.created_at ASC
  `).all(...commentIds) as ReactionWithUser[];
}

export function toggleReaction(commentId: number, userId: number, emoji: string): { added: boolean } {
  const existing = db.prepare(
    'SELECT id FROM kanban_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?'
  ).get(commentId, userId, emoji);
  if (existing) {
    db.prepare('DELETE FROM kanban_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?').run(commentId, userId, emoji);
    return { added: false };
  }
  db.prepare('INSERT INTO kanban_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)').run(commentId, userId, emoji);
  return { added: true };
}

// ── Watchers ────────────────────────────────────────────────────────────────

export function findWatchersByTicketId(ticketId: number): WatcherWithEmail[] {
  return db.prepare(`
    SELECT w.*, u.email
    FROM kanban_watchers w
    INNER JOIN auth_users u ON w.user_id = u.id
    WHERE w.ticket_id = ?
    ORDER BY w.created_at ASC
  `).all(ticketId) as WatcherWithEmail[];
}

export function isWatching(ticketId: number, userId: number): boolean {
  const row = db.prepare(
    'SELECT id FROM kanban_watchers WHERE ticket_id = ? AND user_id = ?'
  ).get(ticketId, userId);
  return !!row;
}

export function addWatcher(ticketId: number, userId: number): void {
  db.prepare(
    'INSERT OR IGNORE INTO kanban_watchers (ticket_id, user_id) VALUES (?, ?)'
  ).run(ticketId, userId);
}

export function removeWatcher(ticketId: number, userId: number): void {
  db.prepare('DELETE FROM kanban_watchers WHERE ticket_id = ? AND user_id = ?').run(ticketId, userId);
}

// ── Notifications ────────────────────────────────────────────────────────────

export function findNotificationsByUserId(userId: number, limit = 50): AppNotification[] {
  return db.prepare(
    'SELECT * FROM kanban_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as AppNotification[];
}

export function countUnreadNotifications(userId: number): number {
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM kanban_notifications WHERE user_id = ? AND read = 0'
  ).get(userId) as CountResult;
  return row.count;
}

export function createNotification(userId: number, type: string, title: string, message: string, ticketId?: number, projectId?: number): AppNotification {
  const result = db.prepare(
    'INSERT INTO kanban_notifications (user_id, type, title, message, ticket_id, project_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, type, title, message, ticketId ?? null, projectId ?? null);
  return db.prepare('SELECT * FROM kanban_notifications WHERE id = ?').get(result.lastInsertRowid) as AppNotification;
}

export function markNotificationRead(id: number, userId: number): void {
  db.prepare('UPDATE kanban_notifications SET read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
}

export function markAllNotificationsRead(userId: number): void {
  db.prepare('UPDATE kanban_notifications SET read = 1 WHERE user_id = ? AND read = 0').run(userId);
}

export function deleteNotification(id: number, userId: number): void {
  db.prepare('DELETE FROM kanban_notifications WHERE id = ? AND user_id = ?').run(id, userId);
}

export function notifyWatchers(ticketId: number, excludeUserId: number, type: string, title: string, message: string, projectId?: number): AppNotification[] {
  const watchers = findWatchersByTicketId(ticketId);
  const notifications: AppNotification[] = [];
  for (const w of watchers) {
    if (w.user_id === excludeUserId) continue;
    const notif = createNotification(w.user_id, type, title, message, ticketId, projectId);
    notifications.push(notif);
  }
  return notifications;
}

// ── Subtasks ────────────────────────────────────────────────────────────────

export function findSubtasksByTicketId(ticketId: number): Subtask[] {
  return db.prepare('SELECT * FROM kanban_subtasks WHERE ticket_id = ? ORDER BY position ASC, id ASC').all(ticketId) as Subtask[];
}

export function createSubtask(ticketId: number, title: string): Subtask {
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM kanban_subtasks WHERE ticket_id = ?').get(ticketId) as { next_pos: number };
  const result = db.prepare('INSERT INTO kanban_subtasks (ticket_id, title, position) VALUES (?, ?, ?)').run(ticketId, title, maxPos.next_pos);
  return db.prepare('SELECT * FROM kanban_subtasks WHERE id = ?').get(result.lastInsertRowid) as Subtask;
}

export function updateSubtask(id: number, fields: { title?: string; completed?: number; position?: number }): Subtask | undefined {
  const updates: string[] = [];
  const values: (string | number)[] = [];
  if (fields.title !== undefined) { updates.push('title = ?'); values.push(fields.title); }
  if (fields.completed !== undefined) { updates.push('completed = ?'); values.push(fields.completed); }
  if (fields.position !== undefined) { updates.push('position = ?'); values.push(fields.position); }
  if (updates.length === 0) return undefined;
  values.push(id);
  db.prepare(`UPDATE kanban_subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM kanban_subtasks WHERE id = ?').get(id) as Subtask | undefined;
}

export function deleteSubtask(id: number): void {
  db.prepare('DELETE FROM kanban_subtasks WHERE id = ?').run(id);
}

export function toggleSubtask(id: number): Subtask | undefined {
  db.prepare('UPDATE kanban_subtasks SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?').run(id);
  return db.prepare('SELECT * FROM kanban_subtasks WHERE id = ?').get(id) as Subtask | undefined;
}

export function findSubtaskById(id: number): Subtask | undefined {
  return db.prepare('SELECT * FROM kanban_subtasks WHERE id = ?').get(id) as Subtask | undefined;
}

// ── Labels ──────────────────────────────────────────────────────────────────

export function findLabelsByProjectId(projectId: number): Label[] {
  return db.prepare('SELECT * FROM kanban_labels WHERE project_id = ? ORDER BY name ASC').all(projectId) as Label[];
}

export function findLabelsByTicketId(ticketId: number): Label[] {
  return db.prepare(`
    SELECT l.* FROM kanban_labels l
    INNER JOIN kanban_ticket_labels tl ON l.id = tl.label_id
    WHERE tl.ticket_id = ?
    ORDER BY l.name ASC
  `).all(ticketId) as Label[];
}

export function findLabelById(id: number): Label | undefined {
  return db.prepare('SELECT * FROM kanban_labels WHERE id = ?').get(id) as Label | undefined;
}

export function createLabel(projectId: number, name: string, color: string): Label {
  const result = db.prepare('INSERT INTO kanban_labels (project_id, name, color) VALUES (?, ?, ?)').run(projectId, name, color);
  return db.prepare('SELECT * FROM kanban_labels WHERE id = ?').get(result.lastInsertRowid) as Label;
}

export function updateLabel(id: number, fields: { name?: string; color?: string }): Label | undefined {
  const updates: string[] = [];
  const values: (string)[] = [];
  if (fields.name !== undefined) { updates.push('name = ?'); values.push(fields.name); }
  if (fields.color !== undefined) { updates.push('color = ?'); values.push(fields.color); }
  if (updates.length === 0) return undefined;
  values.push(String(id));
  db.prepare(`UPDATE kanban_labels SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM kanban_labels WHERE id = ?').get(id) as Label | undefined;
}

export function deleteLabel(id: number): void {
  db.prepare('DELETE FROM kanban_ticket_labels WHERE label_id = ?').run(id);
  db.prepare('DELETE FROM kanban_labels WHERE id = ?').run(id);
}

export function addTicketLabel(ticketId: number, labelId: number): void {
  db.prepare('INSERT OR IGNORE INTO kanban_ticket_labels (ticket_id, label_id) VALUES (?, ?)').run(ticketId, labelId);
}

export function removeTicketLabel(ticketId: number, labelId: number): void {
  db.prepare('DELETE FROM kanban_ticket_labels WHERE ticket_id = ? AND label_id = ?').run(ticketId, labelId);
}

// ── Favorites ───────────────────────────────────────────────────────────────

export function findFavoritesByUserId(userId: number): FavoriteWithTicket[] {
  return db.prepare(`
    SELECT f.*, t.title, t.status, t.priority
    FROM kanban_favorites f
    INNER JOIN kanban_tickets t ON f.ticket_id = t.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId) as FavoriteWithTicket[];
}

export function isFavorite(userId: number, ticketId: number): boolean {
  const row = db.prepare('SELECT user_id FROM kanban_favorites WHERE user_id = ? AND ticket_id = ?').get(userId, ticketId);
  return !!row;
}

export function toggleFavorite(userId: number, ticketId: number): { favorited: boolean } {
  const existing = db.prepare('SELECT user_id FROM kanban_favorites WHERE user_id = ? AND ticket_id = ?').get(userId, ticketId);
  if (existing) {
    db.prepare('DELETE FROM kanban_favorites WHERE user_id = ? AND ticket_id = ?').run(userId, ticketId);
    return { favorited: false };
  }
  db.prepare('INSERT INTO kanban_favorites (user_id, ticket_id) VALUES (?, ?)').run(userId, ticketId);
  return { favorited: true };
}

// ── Ticket Templates ────────────────────────────────────────────────────────

export function findTemplatesByProjectId(projectId: number): TicketTemplate[] {
  return db.prepare('SELECT * FROM kanban_ticket_templates WHERE project_id = ? ORDER BY name ASC').all(projectId) as TicketTemplate[];
}

export function findTemplateById(id: number): TicketTemplate | undefined {
  return db.prepare('SELECT * FROM kanban_ticket_templates WHERE id = ?').get(id) as TicketTemplate | undefined;
}

export function createTemplate(projectId: number, data: { name: string; title_template?: string; description_template?: string; priority?: string; template?: string; tags?: string[] }): TicketTemplate {
  const result = db.prepare(
    'INSERT INTO kanban_ticket_templates (project_id, name, title_template, description_template, priority, template, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    projectId,
    data.name,
    data.title_template || '',
    data.description_template || '',
    data.priority || 'medium',
    data.template || 'feature',
    JSON.stringify(data.tags || []),
  );
  return db.prepare('SELECT * FROM kanban_ticket_templates WHERE id = ?').get(result.lastInsertRowid) as TicketTemplate;
}

export function updateTemplate(id: number, fields: Record<string, any>): TicketTemplate | undefined {
  const allowed = ['name', 'title_template', 'description_template', 'priority', 'template', 'tags'];
  const updates: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(key === 'tags' ? JSON.stringify(fields[key]) : fields[key]);
    }
  }
  if (updates.length === 0) return undefined;
  values.push(id);
  db.prepare(`UPDATE kanban_ticket_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM kanban_ticket_templates WHERE id = ?').get(id) as TicketTemplate | undefined;
}

export function deleteTemplate(id: number): void {
  db.prepare('DELETE FROM kanban_ticket_templates WHERE id = ?').run(id);
}

// ── User Webhooks ───────────────────────────────────────────────────────────

export function findUserWebhooksByProjectId(projectId: number): UserWebhook[] {
  return db.prepare('SELECT * FROM kanban_user_webhooks WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as UserWebhook[];
}

export function findUserWebhookById(id: number): UserWebhook | undefined {
  return db.prepare('SELECT * FROM kanban_user_webhooks WHERE id = ?').get(id) as UserWebhook | undefined;
}

export function createUserWebhook(projectId: number, data: { url: string; events: string[]; secret?: string }): UserWebhook {
  const result = db.prepare(
    'INSERT INTO kanban_user_webhooks (project_id, url, events, secret) VALUES (?, ?, ?, ?)'
  ).run(projectId, data.url, JSON.stringify(data.events), data.secret || null);
  return db.prepare('SELECT * FROM kanban_user_webhooks WHERE id = ?').get(result.lastInsertRowid) as UserWebhook;
}

export function updateUserWebhook(id: number, fields: Record<string, any>): UserWebhook | undefined {
  const allowed = ['url', 'events', 'enabled', 'secret'];
  const updates: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(key === 'events' ? JSON.stringify(fields[key]) : fields[key]);
    }
  }
  if (updates.length === 0) return undefined;
  values.push(id);
  db.prepare(`UPDATE kanban_user_webhooks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM kanban_user_webhooks WHERE id = ?').get(id) as UserWebhook | undefined;
}

export function deleteUserWebhook(id: number): void {
  db.prepare('DELETE FROM kanban_user_webhooks WHERE id = ?').run(id);
}

export function findUserWebhooksByEvent(projectId: number, event: string): UserWebhook[] {
  return db.prepare(
    "SELECT * FROM kanban_user_webhooks WHERE project_id = ? AND enabled = 1 AND events LIKE ?"
  ).all(projectId, `%${event}%`) as UserWebhook[];
}

// ── Global Search ───────────────────────────────────────────────────────────

export function globalSearch(projectId: number, query: string): SearchResult[] {
  const pattern = `%${query}%`;
  const results: SearchResult[] = [];

  // Search tickets
  const tickets = db.prepare(`
    SELECT id, id as ticket_id, title, COALESCE(description, '') as snippet, created_at
    FROM kanban_tickets
    WHERE project_id = ? AND (title LIKE ? OR description LIKE ?)
    ORDER BY updated_at DESC LIMIT 20
  `).all(projectId, pattern, pattern) as any[];
  for (const t of tickets) {
    results.push({ type: 'ticket', id: t.id, ticket_id: t.ticket_id, title: t.title, snippet: t.snippet.substring(0, 200), created_at: t.created_at });
  }

  // Search comments
  const comments = db.prepare(`
    SELECT c.id, c.ticket_id, t.title, c.content as snippet, c.created_at
    FROM kanban_comments c
    INNER JOIN kanban_tickets t ON c.ticket_id = t.id
    WHERE t.project_id = ? AND c.content LIKE ?
    ORDER BY c.created_at DESC LIMIT 10
  `).all(projectId, pattern) as any[];
  for (const c of comments) {
    results.push({ type: 'comment', id: c.id, ticket_id: c.ticket_id, title: c.title, snippet: c.snippet.substring(0, 200), created_at: c.created_at });
  }

  // Search activity
  const activities = db.prepare(`
    SELECT a.id, a.ticket_id, COALESCE(t.title, '') as title, a.message as snippet, a.created_at
    FROM kanban_activity a
    LEFT JOIN kanban_tickets t ON a.ticket_id = t.id
    WHERE t.project_id = ? AND a.message LIKE ?
    ORDER BY a.created_at DESC LIMIT 10
  `).all(projectId, pattern) as any[];
  for (const a of activities) {
    results.push({ type: 'activity', id: a.id, ticket_id: a.ticket_id, title: a.title, snippet: a.snippet.substring(0, 200), created_at: a.created_at });
  }

  return results;
}

// ── Deploy Configs ──────────────────────────────────────────────────────────

export function findDeployConfigByProject(projectId: number): DeployConfig | undefined {
  return db.prepare('SELECT * FROM kanban_deploy_configs WHERE project_id = ?').get(projectId) as DeployConfig | undefined;
}

export function createDeployConfig(projectId: number, data: Partial<DeployConfig>): DeployConfig {
  const result = db.prepare(
    'INSERT INTO kanban_deploy_configs (project_id, cf_project_name, cf_site_url, cf_api_token, cf_account_id, supabase_tenant_id, custom_domain) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    projectId,
    data.cf_project_name || null,
    data.cf_site_url || null,
    data.cf_api_token || null,
    data.cf_account_id || null,
    data.supabase_tenant_id || null,
    data.custom_domain || null,
  );
  return db.prepare('SELECT * FROM kanban_deploy_configs WHERE id = ?').get(result.lastInsertRowid) as DeployConfig;
}

export function updateDeployConfig(projectId: number, data: Partial<DeployConfig>): void {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.cf_project_name !== undefined) { updates.push('cf_project_name = ?'); values.push(data.cf_project_name); }
  if (data.cf_site_url !== undefined) { updates.push('cf_site_url = ?'); values.push(data.cf_site_url); }
  if (data.cf_api_token !== undefined) { updates.push('cf_api_token = ?'); values.push(data.cf_api_token); }
  if (data.cf_account_id !== undefined) { updates.push('cf_account_id = ?'); values.push(data.cf_account_id); }
  if (data.supabase_tenant_id !== undefined) { updates.push('supabase_tenant_id = ?'); values.push(data.supabase_tenant_id); }
  if (data.custom_domain !== undefined) { updates.push('custom_domain = ?'); values.push(data.custom_domain); }

  if (updates.length === 0) return;
  values.push(projectId);
  db.prepare(`UPDATE kanban_deploy_configs SET ${updates.join(', ')} WHERE project_id = ?`).run(...values);
}

export function updateProjectSetup(projectId: number, completed: boolean): void {
  db.prepare("UPDATE kanban_projects SET setup_completed = ?, updated_at = datetime('now') WHERE id = ?").run(completed ? 1 : 0, projectId);
}

export function getProjectSetupStatus(projectId: number): ProjectSetupStatus {
  const project = findProjectById(projectId);
  if (!project) {
    return { repoConfigured: false, deployConfigured: false, gitProvider: null, repoUrl: null, cfSiteUrl: null };
  }

  const repo = findRepoById(project.default_repo);
  const repoConfigured = !!(repo && (repo.clone_url || (repo.bitbucket_workspace && repo.bitbucket_repo_slug)));

  const deploy = findDeployConfigByProject(projectId);
  const deployConfigured = !!(deploy && deploy.cf_project_name);

  return {
    repoConfigured,
    deployConfigured,
    gitProvider: repo?.git_provider || null,
    repoUrl: repo?.clone_url || null,
    cfSiteUrl: deploy?.cf_site_url || null,
  };
}

export function createOrUpdateRepo(id: string, data: Partial<Repo>): Repo {
  const existing = findRepoById(id);
  if (existing) {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    if (data.label !== undefined) { updates.push('label = ?'); values.push(data.label); }
    if (data.bitbucket_workspace !== undefined) { updates.push('bitbucket_workspace = ?'); values.push(data.bitbucket_workspace); }
    if (data.bitbucket_repo_slug !== undefined) { updates.push('bitbucket_repo_slug = ?'); values.push(data.bitbucket_repo_slug); }
    if (data.default_branch !== undefined) { updates.push('default_branch = ?'); values.push(data.default_branch); }
    if (data.local_path !== undefined) { updates.push('local_path = ?'); values.push(data.local_path); }
    if (data.git_provider !== undefined) { updates.push('git_provider = ?'); values.push(data.git_provider); }
    if (data.provider_owner !== undefined) { updates.push('provider_owner = ?'); values.push(data.provider_owner); }
    if (data.provider_repo !== undefined) { updates.push('provider_repo = ?'); values.push(data.provider_repo); }
    if (data.provider_token !== undefined) { updates.push('provider_token = ?'); values.push(data.provider_token); }
    if (data.clone_url !== undefined) { updates.push('clone_url = ?'); values.push(data.clone_url); }
    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE kanban_repos SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    return db.prepare('SELECT * FROM kanban_repos WHERE id = ?').get(id) as Repo;
  }
  db.prepare(
    'INSERT INTO kanban_repos (id, label, bitbucket_workspace, bitbucket_repo_slug, default_branch, git_provider, provider_owner, provider_repo, provider_token, clone_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    data.label || id,
    data.bitbucket_workspace || '',
    data.bitbucket_repo_slug || '',
    data.default_branch || 'main',
    data.git_provider || 'bitbucket',
    data.provider_owner || '',
    data.provider_repo || '',
    data.provider_token || '',
    data.clone_url || '',
  );
  return db.prepare('SELECT * FROM kanban_repos WHERE id = ?').get(id) as Repo;
}

// ── Activity (project-scoped) ───────────────────────────────────────────────

export function findActivityByProjectId(projectId: number, limit = 50, offset = 0, typeFilter?: string): ActivityWithTitle[] {
  let sql = `
    SELECT a.*, t.title as ticket_title
    FROM kanban_activity a
    LEFT JOIN kanban_tickets t ON a.ticket_id = t.id
    WHERE t.project_id = ?
  `;
  const params: (string | number)[] = [projectId];
  if (typeFilter) {
    sql += ' AND a.activity_type = ?';
    params.push(typeFilter);
  }
  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(sql).all(...params) as ActivityWithTitle[];
}
