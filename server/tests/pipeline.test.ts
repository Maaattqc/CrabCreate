import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

// ── Migration SQL ────────────────────────────────────────────────────────────

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    is_admin INTEGER DEFAULT 0,
    plan TEXT DEFAULT 'free',
    blocked INTEGER DEFAULT 0,
    blocked_reason TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_subscription_status TEXT,
    preferences TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS kanban_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'backlog',
    template TEXT DEFAULT 'feature',
    ai_model TEXT DEFAULT 'claude',
    repo TEXT DEFAULT 'main-site',
    assignee TEXT DEFAULT 'unassigned',
    complexity TEXT DEFAULT 'unknown',
    target_files TEXT,
    tags TEXT,
    depends_on TEXT,
    branch_name TEXT,
    pr_url TEXT,
    pr_id INTEGER,
    staging_url TEXT,
    lines_added INTEGER DEFAULT 0,
    lines_removed INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    ai_review_score INTEGER,
    ai_review_data TEXT,
    test_results TEXT,
    progress INTEGER DEFAULT 0,
    user_id INTEGER,
    project_id INTEGER,
    last_modified_by INTEGER,
    position INTEGER DEFAULT 0,
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    message TEXT,
    log_type TEXT DEFAULT 'info',
    phase TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    message TEXT,
    activity_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_file_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    locked_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_repos (
    id TEXT PRIMARY KEY,
    label TEXT,
    bitbucket_workspace TEXT,
    bitbucket_repo_slug TEXT,
    default_branch TEXT DEFAULT 'master',
    target_branch TEXT DEFAULT 'develop',
    local_path TEXT,
    git_provider TEXT DEFAULT 'bitbucket',
    provider_owner TEXT DEFAULT '',
    provider_repo TEXT DEFAULT '',
    provider_token TEXT DEFAULT '',
    clone_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    slug TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES auth_users(id),
    is_private INTEGER DEFAULT 1,
    default_repo TEXT DEFAULT 'main-site',
    setup_completed INTEGER DEFAULT 0,
    cursors_enabled INTEGER DEFAULT 1,
    presence_enabled INTEGER DEFAULT 1,
    presence_max_visible INTEGER DEFAULT 5,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_slug ON kanban_projects(owner_id, slug);

  CREATE TABLE IF NOT EXISTS kanban_project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES auth_users(id),
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

// ── Mock DB ──────────────────────────────────────────────────────────────────

let testDb: InstanceType<typeof Database>;

vi.mock('../db/sqlite', () => {
  return { default: null as unknown as InstanceType<typeof Database> };
});

// Mock external services
vi.mock('../services/dependency-checker');
vi.mock('../services/file-locker');
vi.mock('../services/ai-coder');
vi.mock('../services/ai-reviewer');
vi.mock('../services/test-generator');
vi.mock('../services/deployer');
vi.mock('../socket', () => ({
  emitTicketLog: vi.fn(),
  emitTicketStatus: vi.fn(),
  emitTicketUpdated: vi.fn(),
  emitNotification: vi.fn(),
}));
vi.mock('../services/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../middleware/pipeline-guard', () => ({
  pipelineGuard: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock('../middleware/plan-limit', () => ({
  checkPipelineLimit: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock('../permissions', () => ({
  canLaunchPipeline: vi.fn(() => true),
  canModifyTicket: vi.fn(() => true),
  hasMinRole: vi.fn(() => true),
}));

import * as sqliteMock from '../db/sqlite';
import * as repo from '../db/repositories';
import * as dependencyChecker from '../services/dependency-checker';
import * as fileLocker from '../services/file-locker';
import * as aiCoder from '../services/ai-coder';
import * as aiReviewer from '../services/ai-reviewer';
import * as testGenerator from '../services/test-generator';
import * as deployer from '../services/deployer';
import { canLaunchPipeline, canModifyTicket } from '../permissions';
import pipelineRouter from '../routes/pipeline';

import type { CodingResult, ReviewResult, TestResults, DeployResult } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_CODING_RESULT: CodingResult = {
  files: [{ path: 'index.php', content: '<?php echo "ok"; ?>' }],
  baseFiles: [{ path: 'index.php', content: '<?php echo "hello"; ?>' }],
  summary: 'Test change',
  diff: '+line added\n-line removed',
  linesAdded: 10,
  linesRemoved: 2,
  tokensUsed: 500,
  costUsd: 0.01,
  branchName: 'kanban/ticket-1-test',
  repoDir: '/tmp/repo',
  previewPath: '',
};

const MOCK_REVIEW_RESULT: ReviewResult = {
  score: 85,
  summary: 'Good code',
  issues: [],
};

const MOCK_TEST_RESULTS: TestResults = {
  total: 3,
  passed: 3,
  failed: 0,
  duration: 150,
  tests: [
    { name: 'test_1', file: 'index.php', status: 'passed', message: null, duration: 50 },
    { name: 'test_2', file: 'index.php', status: 'passed', message: null, duration: 50 },
    { name: 'test_3', file: 'index.php', status: 'passed', message: null, duration: 50 },
  ],
};

const MOCK_DEPLOY_RESULT: DeployResult = {
  prUrl: 'https://github.com/org/repo/pull/42',
  prId: 42,
  stagingUrl: 'https://staging.example.com',
};

let app: express.Express;
let userId: number;
let projectId: number;
let ticketId: number;

function buildApp() {
  const a = express();
  a.use(express.json());
  // Inject req.user and req.project for all routes
  a.use((req, _res, next) => {
    (req as any).user = { userId, email: 'admin@test.com', isAdmin: true };
    (req as any).project = { id: projectId, userRole: 'owner' as const };
    next();
  });
  a.use('/api/pipeline', pipelineRouter);
  return a;
}

function setupDefaultMocks() {
  (dependencyChecker.check as Mock).mockReturnValue({ ok: true });
  (fileLocker.checkAndLock as Mock).mockReturnValue({ ok: true });
  (fileLocker.unlock as Mock).mockReturnValue(undefined);
  (aiCoder.estimateComplexity as Mock).mockResolvedValue({ complexity: 'medium' });
  (aiCoder.generateCode as Mock).mockResolvedValue(MOCK_CODING_RESULT);
  (aiReviewer.review as Mock).mockResolvedValue(MOCK_REVIEW_RESULT);
  (testGenerator.runTests as Mock).mockResolvedValue(MOCK_TEST_RESULTS);
  (deployer.deployToStaging as Mock).mockResolvedValue(MOCK_DEPLOY_RESULT);
  (deployer.mergeToProduction as Mock).mockResolvedValue(undefined);
  (deployer.closePR as Mock).mockResolvedValue(undefined);
  (deployer.rollback as Mock).mockResolvedValue(undefined);
  (canLaunchPipeline as Mock).mockReturnValue(true);
  (canModifyTicket as Mock).mockReturnValue(true);
}

/** Wait for the async pipeline (fire-and-forget) to finish */
function waitForPipeline(ms = 200): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(MIGRATION_SQL);
  (sqliteMock as any).default = testDb;

  // Create admin user
  const userRow = testDb.prepare("INSERT INTO auth_users (email, is_admin, plan) VALUES ('admin@test.com', 1, 'enterprise')").run();
  userId = Number(userRow.lastInsertRowid);

  // Create project with setup_completed = 1
  const projectRow = testDb.prepare(
    "INSERT INTO kanban_projects (name, description, slug, owner_id, setup_completed) VALUES ('Test Project', '', 'test', ?, 1)"
  ).run(userId);
  projectId = Number(projectRow.lastInsertRowid);

  // Add user as project member (owner)
  testDb.prepare("INSERT INTO kanban_project_members (project_id, user_id, role) VALUES (?, ?, 'owner')").run(projectId, userId);

  // Create a ticket in backlog
  const ticketRow = testDb.prepare(
    "INSERT INTO kanban_tickets (title, description, status, user_id, project_id) VALUES ('Test ticket', 'Test description', 'backlog', ?, ?)"
  ).run(userId, projectId);
  ticketId = Number(ticketRow.lastInsertRowid);

  // Create repo record
  testDb.prepare(
    "INSERT INTO kanban_repos (id, label, git_provider, provider_owner, provider_repo, provider_token) VALUES ('main-site', 'Main Site', 'github', 'org', 'repo', 'tok_123')"
  ).run();

  // Configure settings
  repo.setConfig('ai_review_threshold', '50');
  repo.setConfig('auto_test_enabled', '1');
  repo.setConfig('auto_deploy_enabled', '1');

  setupDefaultMocks();
  app = buildApp();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Pipeline E2E', () => {

  // 1. Happy path complet
  describe('POST /api/pipeline/launch/:id — happy path', () => {
    it('returns 200 and completes the full pipeline', async () => {
      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      await waitForPipeline();

      // Verify ticket final state
      const ticket = repo.findTicketById(ticketId);
      expect(ticket).toBeDefined();
      expect(ticket!.status).toBe('review');
      expect(ticket!.progress).toBe(100);
      expect(ticket!.ai_review_score).toBe(85);
      expect(ticket!.pr_url).toBe(MOCK_DEPLOY_RESULT.prUrl);
      expect(ticket!.pr_id).toBe(MOCK_DEPLOY_RESULT.prId);
      expect(ticket!.lines_added).toBe(10);
      expect(ticket!.lines_removed).toBe(2);
      expect(ticket!.tokens_used).toBe(500);
      expect(ticket!.complexity).toBe('medium');
      expect(ticket!.branch_name).toBe('kanban/ticket-1-test');

      // Verify services called in order
      expect(dependencyChecker.check).toHaveBeenCalledTimes(1);
      expect(fileLocker.checkAndLock).toHaveBeenCalledTimes(1);
      expect(aiCoder.estimateComplexity).toHaveBeenCalledTimes(1);
      expect(aiCoder.generateCode).toHaveBeenCalledTimes(1);
      expect(aiReviewer.review).toHaveBeenCalledTimes(1);
      expect(testGenerator.runTests).toHaveBeenCalledTimes(1);
      expect(deployer.deployToStaging).toHaveBeenCalledTimes(1);
    });
  });

  // 2. Project not configured
  describe('POST /api/pipeline/launch/:id — project not configured', () => {
    it('returns 400 when setup_completed is 0', async () => {
      testDb.prepare("UPDATE kanban_projects SET setup_completed = 0 WHERE id = ?").run(projectId);

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('project_not_configured');
    });
  });

  // 3. Dependency check fails
  describe('POST /api/pipeline/launch/:id — dependency check fails', () => {
    it('sets ticket to queued when dependency is not approved', async () => {
      (dependencyChecker.check as Mock).mockReturnValue({
        ok: false,
        message: 'En attente du ticket #99 "Other" (statut: backlog)',
      });

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);

      await waitForPipeline();

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('queued');
      expect(aiCoder.estimateComplexity).not.toHaveBeenCalled();
    });
  });

  // 4. File lock conflict
  describe('POST /api/pipeline/launch/:id — file lock conflict', () => {
    it('sets ticket to queued when file is locked', async () => {
      (fileLocker.checkAndLock as Mock).mockReturnValue({
        ok: false,
        message: 'Fichier "index.php" bloqué par le ticket #5',
      });

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);

      await waitForPipeline();

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('queued');
      expect(aiCoder.estimateComplexity).not.toHaveBeenCalled();
    });
  });

  // 5. AI review score too low — auto-reject
  describe('POST /api/pipeline/launch/:id — low review score auto-rejects', () => {
    it('rejects ticket when score is below threshold', async () => {
      (aiReviewer.review as Mock).mockResolvedValue({
        score: 30,
        summary: 'Poor code',
        issues: [{ severity: 'error', message: 'Critical bug', file: null, line: null }],
      });

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);

      await waitForPipeline();

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('rejected');
      expect(ticket!.ai_review_score).toBe(30);
      expect(fileLocker.unlock).toHaveBeenCalledWith(ticketId);
      expect(testGenerator.runTests).not.toHaveBeenCalled();
      expect(deployer.deployToStaging).not.toHaveBeenCalled();
    });
  });

  // 6. Auto-test disabled
  describe('POST /api/pipeline/launch/:id — auto_test_enabled=0', () => {
    it('skips test stage when disabled', async () => {
      repo.setConfig('auto_test_enabled', '0');

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);

      await waitForPipeline();

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('review');
      expect(ticket!.progress).toBe(100);
      expect(testGenerator.runTests).not.toHaveBeenCalled();
      expect(deployer.deployToStaging).toHaveBeenCalledTimes(1);
    });
  });

  // 7. Auto-deploy disabled
  describe('POST /api/pipeline/launch/:id — auto_deploy_enabled=0', () => {
    it('goes directly to review without deploying', async () => {
      repo.setConfig('auto_deploy_enabled', '0');

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);

      await waitForPipeline();

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('review');
      expect(ticket!.progress).toBe(100);
      expect(deployer.deployToStaging).not.toHaveBeenCalled();
    });
  });

  // 8. Approve
  describe('POST /api/pipeline/approve/:id', () => {
    it('approves and merges the ticket', async () => {
      // Set ticket to review state first
      testDb.prepare("UPDATE kanban_tickets SET status = 'review', pr_id = 42, pr_url = 'https://github.com/org/repo/pull/42' WHERE id = ?").run(ticketId);

      const res = await request(app).post(`/api/pipeline/approve/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('approved');
      expect(deployer.mergeToProduction).toHaveBeenCalledTimes(1);
      expect(fileLocker.unlock).toHaveBeenCalledWith(ticketId);
    });
  });

  // 9. Reject
  describe('POST /api/pipeline/reject/:id', () => {
    it('rejects and closes PR', async () => {
      testDb.prepare("UPDATE kanban_tickets SET status = 'review', pr_id = 42 WHERE id = ?").run(ticketId);

      const res = await request(app).post(`/api/pipeline/reject/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('rejected');
      expect(deployer.closePR).toHaveBeenCalledTimes(1);
      expect(fileLocker.unlock).toHaveBeenCalledWith(ticketId);
    });
  });

  // 10. Retry
  describe('POST /api/pipeline/retry/:id', () => {
    it('resets ticket to backlog', async () => {
      testDb.prepare("UPDATE kanban_tickets SET status = 'rejected' WHERE id = ?").run(ticketId);

      const res = await request(app).post(`/api/pipeline/retry/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('backlog');
      expect(fileLocker.unlock).toHaveBeenCalledWith(ticketId);
    });
  });

  // 11. Rollback
  describe('POST /api/pipeline/rollback/:id', () => {
    it('rolls back and sets ticket to rejected', async () => {
      testDb.prepare("UPDATE kanban_tickets SET status = 'approved' WHERE id = ?").run(ticketId);

      const res = await request(app).post(`/api/pipeline/rollback/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('rejected');
      expect(deployer.rollback).toHaveBeenCalledTimes(1);
    });
  });

  // 12. Ticket not found
  describe('POST /api/pipeline/launch/9999 — ticket not found', () => {
    it('returns 404', async () => {
      const res = await request(app).post('/api/pipeline/launch/9999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Ticket not found');
    });
  });

  // 13. Access denied (viewer)
  describe('POST /api/pipeline/launch/:id — access denied', () => {
    it('returns 403 when user cannot launch pipeline', async () => {
      (canLaunchPipeline as Mock).mockReturnValue(false);

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });
  });

  // 14. Approve — ticket not found
  describe('POST /api/pipeline/approve/9999 — ticket not found', () => {
    it('returns 404', async () => {
      const res = await request(app).post('/api/pipeline/approve/9999');
      expect(res.status).toBe(404);
    });
  });

  // 15. Reject — access denied
  describe('POST /api/pipeline/reject/:id — access denied', () => {
    it('returns 403 when user cannot modify ticket', async () => {
      (canModifyTicket as Mock).mockReturnValue(false);

      const res = await request(app).post(`/api/pipeline/reject/${ticketId}`);
      expect(res.status).toBe(403);
    });
  });

  // 16. Pipeline error resets ticket to backlog
  describe('POST /api/pipeline/launch/:id — pipeline error', () => {
    it('resets ticket to backlog on internal error', async () => {
      (aiCoder.generateCode as Mock).mockRejectedValue(new Error('AI API error: rate limited'));

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(200);

      await waitForPipeline();

      const ticket = repo.findTicketById(ticketId);
      expect(ticket!.status).toBe('backlog');
      expect(ticket!.progress).toBe(0);
      expect(fileLocker.unlock).toHaveBeenCalledWith(ticketId);
    });
  });

  // 17. Ticket in wrong project
  describe('POST /api/pipeline/launch/:id — wrong project', () => {
    it('returns 403 when ticket belongs to different project', async () => {
      // Change ticket to a different project
      testDb.prepare("UPDATE kanban_tickets SET project_id = 999 WHERE id = ?").run(ticketId);

      const res = await request(app).post(`/api/pipeline/launch/${ticketId}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });
  });
});
