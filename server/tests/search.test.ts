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

  CREATE TABLE IF NOT EXISTS kanban_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES auth_users(id),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    message TEXT,
    activity_type TEXT,
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
  createTicket,
  createComment,
  insertActivity,
  globalSearch,
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

describe('Global search', () => {
  it('globalSearch finds tickets by title', () => {
    const { user, project } = createTestProject();
    createTicket({ title: 'Fix login bug' }, user.id, project.id);
    createTicket({ title: 'Add dashboard' }, user.id, project.id);

    const results = globalSearch(project.id, 'login');

    expect(results.length).toBeGreaterThanOrEqual(1);
    const ticketResults = results.filter(r => r.type === 'ticket');
    expect(ticketResults).toHaveLength(1);
    expect(ticketResults[0].title).toBe('Fix login bug');
  });

  it('globalSearch finds tickets by description', () => {
    const { user, project } = createTestProject();
    createTicket({ title: 'Some ticket', description: 'This involves the authentication module' }, user.id, project.id);

    const results = globalSearch(project.id, 'authentication');

    const ticketResults = results.filter(r => r.type === 'ticket');
    expect(ticketResults).toHaveLength(1);
    expect(ticketResults[0].title).toBe('Some ticket');
  });

  it('globalSearch finds comments by content', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'A ticket' }, user.id, project.id);
    createComment(ticket.id, user.id, 'This is a special remark about deployment');

    const results = globalSearch(project.id, 'deployment');

    const commentResults = results.filter(r => r.type === 'comment');
    expect(commentResults).toHaveLength(1);
    expect(commentResults[0].snippet).toContain('deployment');
  });

  it('globalSearch returns empty for no matches', () => {
    const { user, project } = createTestProject();
    createTicket({ title: 'Normal ticket' }, user.id, project.id);

    const results = globalSearch(project.id, 'xyznonexistent');
    expect(results).toHaveLength(0);
  });

  it('globalSearch respects project scope', () => {
    const { user, project } = createTestProject();
    createTicket({ title: 'Project 1 ticket with unique keyword' }, user.id, project.id);

    // Create a second project
    const user2 = createUser('other@example.com');
    testDb.prepare("INSERT INTO kanban_projects (name, slug, owner_id) VALUES (?, ?, ?)").run('Other', 'other', user2.id);
    const project2 = testDb.prepare("SELECT * FROM kanban_projects WHERE owner_id = ?").get(user2.id) as any;
    createTicket({ title: 'Project 2 ticket with unique keyword' }, user2.id, project2.id);

    const results1 = globalSearch(project.id, 'unique keyword');
    expect(results1).toHaveLength(1);
    expect(results1[0].title).toBe('Project 1 ticket with unique keyword');

    const results2 = globalSearch(project2.id, 'unique keyword');
    expect(results2).toHaveLength(1);
    expect(results2[0].title).toBe('Project 2 ticket with unique keyword');
  });
});
