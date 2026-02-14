import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// ── Migration SQL (all tables) ──────────────────────────────────────────────
const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    is_admin INTEGER DEFAULT 0,
    plan TEXT DEFAULT 'free',
    blocked INTEGER DEFAULT 0,
    blocked_reason TEXT,
    preferences TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS kanban_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    slug TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES auth_users(id),
    is_private INTEGER DEFAULT 1,
    default_repo TEXT DEFAULT 'main-site',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
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

  CREATE TABLE IF NOT EXISTS kanban_user_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]',
    secret TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

let testDb: InstanceType<typeof Database>;

vi.mock('../db/sqlite', () => {
  return { default: null as unknown as InstanceType<typeof Database> };
});

import * as sqliteMock from '../db/sqlite';
import {
  createUser,
  createUserWebhook,
  findUserWebhooksByProjectId,
  findUserWebhookById,
  updateUserWebhook,
  deleteUserWebhook,
  findUserWebhooksByEvent,
} from '../db/repositories';

function createTestProject() {
  const user = createUser('test@example.com');
  testDb.prepare("INSERT INTO kanban_projects (name, slug, owner_id) VALUES (?, ?, ?)").run('Test', 'test', user.id);
  const project = testDb.prepare("SELECT * FROM kanban_projects WHERE owner_id = ?").get(user.id) as any;
  return { user, project };
}

beforeEach(() => {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(MIGRATION_SQL);
  (sqliteMock as any).default = testDb;
});

describe('User Webhook repository', () => {
  it('createUserWebhook creates a webhook', () => {
    const { project } = createTestProject();

    const webhook = createUserWebhook(project.id, {
      url: 'https://example.com/hook',
      events: ['ticket.created', 'ticket.updated'],
      secret: 'mysecret',
    });

    expect(webhook).toBeDefined();
    expect(webhook.id).toBe(1);
    expect(webhook.project_id).toBe(project.id);
    expect(webhook.url).toBe('https://example.com/hook');
    expect(JSON.parse(webhook.events)).toEqual(['ticket.created', 'ticket.updated']);
    expect(webhook.secret).toBe('mysecret');
    expect(webhook.enabled).toBe(1);
  });

  it('findUserWebhooksByProjectId returns webhooks', () => {
    const { project } = createTestProject();

    createUserWebhook(project.id, { url: 'https://a.com/hook', events: ['ticket.created'] });
    createUserWebhook(project.id, { url: 'https://b.com/hook', events: ['ticket.updated'] });

    const webhooks = findUserWebhooksByProjectId(project.id);
    expect(webhooks).toHaveLength(2);
  });

  it('findUserWebhookById returns a webhook', () => {
    const { project } = createTestProject();
    const created = createUserWebhook(project.id, { url: 'https://a.com/hook', events: ['ticket.created'] });

    const found = findUserWebhookById(created.id);
    expect(found).toBeDefined();
    expect(found!.url).toBe('https://a.com/hook');
  });

  it('findUserWebhookById returns undefined for non-existent', () => {
    expect(findUserWebhookById(999)).toBeUndefined();
  });

  it('updateUserWebhook updates fields', () => {
    const { project } = createTestProject();
    const webhook = createUserWebhook(project.id, { url: 'https://old.com/hook', events: ['ticket.created'] });

    const updated = updateUserWebhook(webhook.id, {
      url: 'https://new.com/hook',
      enabled: 0,
    });

    expect(updated).toBeDefined();
    expect(updated!.url).toBe('https://new.com/hook');
    expect(updated!.enabled).toBe(0);
  });

  it('deleteUserWebhook removes webhook', () => {
    const { project } = createTestProject();
    const webhook = createUserWebhook(project.id, { url: 'https://a.com/hook', events: ['ticket.created'] });

    expect(findUserWebhookById(webhook.id)).toBeDefined();

    deleteUserWebhook(webhook.id);

    expect(findUserWebhookById(webhook.id)).toBeUndefined();
  });

  it('findUserWebhooksByEvent returns matching webhooks', () => {
    const { project } = createTestProject();

    createUserWebhook(project.id, { url: 'https://a.com/hook', events: ['ticket.created', 'ticket.updated'] });
    createUserWebhook(project.id, { url: 'https://b.com/hook', events: ['ticket.deleted'] });

    const hooks = findUserWebhooksByEvent(project.id, 'ticket.created');
    expect(hooks).toHaveLength(1);
    expect(hooks[0].url).toBe('https://a.com/hook');
  });

  it('findUserWebhooksByEvent excludes disabled webhooks', () => {
    const { project } = createTestProject();

    const webhook = createUserWebhook(project.id, { url: 'https://a.com/hook', events: ['ticket.created'] });
    updateUserWebhook(webhook.id, { enabled: 0 });

    const hooks = findUserWebhooksByEvent(project.id, 'ticket.created');
    expect(hooks).toHaveLength(0);
  });
});
