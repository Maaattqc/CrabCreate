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

  CREATE TABLE IF NOT EXISTS kanban_subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
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
  createSubtask,
  findSubtasksByTicketId,
  findSubtaskById,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
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

describe('Subtask repository', () => {
  it('createSubtask creates a subtask linked to ticket', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);

    const subtask = createSubtask(ticket.id, 'Write unit tests');

    expect(subtask).toBeDefined();
    expect(subtask.id).toBe(1);
    expect(subtask.ticket_id).toBe(ticket.id);
    expect(subtask.title).toBe('Write unit tests');
    expect(subtask.completed).toBe(0);
    expect(subtask.position).toBe(0);
  });

  it('findSubtasksByTicketId returns subtasks for a ticket', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);

    createSubtask(ticket.id, 'Subtask A');
    createSubtask(ticket.id, 'Subtask B');

    const subtasks = findSubtasksByTicketId(ticket.id);
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0].title).toBe('Subtask A');
    expect(subtasks[1].title).toBe('Subtask B');
  });

  it('findSubtasksByTicketId returns empty array for no subtasks', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);

    const subtasks = findSubtasksByTicketId(ticket.id);
    expect(subtasks).toEqual([]);
  });

  it('updateSubtask updates title', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const subtask = createSubtask(ticket.id, 'Original title');

    const updated = updateSubtask(subtask.id, { title: 'Updated title' });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated title');
  });

  it('updateSubtask updates completed', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const subtask = createSubtask(ticket.id, 'Task');

    const updated = updateSubtask(subtask.id, { completed: 1 });

    expect(updated).toBeDefined();
    expect(updated!.completed).toBe(1);
  });

  it('toggleSubtask flips completed state', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const subtask = createSubtask(ticket.id, 'Toggleable');

    expect(subtask.completed).toBe(0);

    const toggled1 = toggleSubtask(subtask.id);
    expect(toggled1).toBeDefined();
    expect(toggled1!.completed).toBe(1);

    const toggled2 = toggleSubtask(subtask.id);
    expect(toggled2).toBeDefined();
    expect(toggled2!.completed).toBe(0);
  });

  it('deleteSubtask removes subtask', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const subtask = createSubtask(ticket.id, 'To delete');

    expect(findSubtaskById(subtask.id)).toBeDefined();

    deleteSubtask(subtask.id);

    expect(findSubtaskById(subtask.id)).toBeUndefined();
  });

  it('findSubtaskById returns undefined for non-existent', () => {
    expect(findSubtaskById(999)).toBeUndefined();
  });
});
