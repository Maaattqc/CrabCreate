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
    archived_at TEXT,
    pipeline_step INTEGER DEFAULT 0,
    column_position INTEGER DEFAULT 0,
    pipeline_started_at TEXT,
    creator_email TEXT,
    modifier_email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_favorites (
    user_id INTEGER NOT NULL REFERENCES auth_users(id),
    ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, ticket_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_status_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at TEXT DEFAULT (datetime('now'))
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
  toggleFavorite,
  findFavoritesByUserId,
  isFavorite,
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

describe('Favorites repository', () => {
  it('toggleFavorite adds a favorite (returns { favorited: true })', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);

    const result = toggleFavorite(user.id, ticket.id);

    expect(result).toEqual({ favorited: true });
  });

  it('toggleFavorite removes existing favorite (returns { favorited: false })', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);

    toggleFavorite(user.id, ticket.id);
    const result = toggleFavorite(user.id, ticket.id);

    expect(result).toEqual({ favorited: false });
  });

  it('findFavoritesByUserId returns favorites list', () => {
    const { user, project } = createTestProject();
    const ticket1 = createTicket({ title: 'Ticket 1' }, user.id, project.id);
    const ticket2 = createTicket({ title: 'Ticket 2' }, user.id, project.id);

    toggleFavorite(user.id, ticket1.id);
    toggleFavorite(user.id, ticket2.id);

    const favorites = findFavoritesByUserId(user.id);
    expect(favorites).toHaveLength(2);
    // Each should have ticket info
    const titles = favorites.map(f => f.title);
    expect(titles).toContain('Ticket 1');
    expect(titles).toContain('Ticket 2');
  });

  it('findFavoritesByUserId returns empty when none', () => {
    const { user } = createTestProject();

    const favorites = findFavoritesByUserId(user.id);
    expect(favorites).toEqual([]);
  });

  it('isFavorite returns true for favorited ticket', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Fav ticket' }, user.id, project.id);

    toggleFavorite(user.id, ticket.id);

    expect(isFavorite(user.id, ticket.id)).toBe(true);
  });

  it('isFavorite returns false for non-favorited ticket', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Not fav' }, user.id, project.id);

    expect(isFavorite(user.id, ticket.id)).toBe(false);
  });
});
