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
`;

let testDb: InstanceType<typeof Database>;

vi.mock('../db/sqlite', () => {
  return { default: null as unknown as InstanceType<typeof Database> };
});

import * as sqliteMock from '../db/sqlite';
import {
  createUser,
  createTicket,
  findAllTickets,
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

describe('Export (CSV data source)', () => {
  it('findAllTickets with project_id returns tickets for that project', () => {
    const { user, project } = createTestProject();
    createTicket({ title: 'Ticket A' }, user.id, project.id);
    createTicket({ title: 'Ticket B' }, user.id, project.id);

    // Create a second project with its own tickets
    const user2 = createUser('other@example.com');
    testDb.prepare("INSERT INTO kanban_projects (name, slug, owner_id) VALUES (?, ?, ?)").run('Other', 'other', user2.id);
    const project2 = testDb.prepare("SELECT * FROM kanban_projects WHERE owner_id = ?").get(user2.id) as any;
    createTicket({ title: 'Ticket C' }, user2.id, project2.id);

    const tickets = findAllTickets({}, undefined, project.id);
    expect(tickets).toHaveLength(2);
    expect(tickets.every(t => t.project_id === project.id)).toBe(true);
  });

  it('tickets with due_date are included in results', () => {
    const { user, project } = createTestProject();
    createTicket({ title: 'With due date', due_date: '2025-12-31' }, user.id, project.id);
    createTicket({ title: 'Without due date' }, user.id, project.id);

    const tickets = findAllTickets({}, undefined, project.id);
    expect(tickets).toHaveLength(2);

    const withDue = tickets.find(t => t.title === 'With due date');
    const withoutDue = tickets.find(t => t.title === 'Without due date');

    expect(withDue).toBeDefined();
    expect(withDue!.due_date).toBe('2025-12-31');
    expect(withoutDue).toBeDefined();
    expect(withoutDue!.due_date).toBeNull();
  });
});
