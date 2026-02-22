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

  CREATE TABLE IF NOT EXISTS kanban_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#94a3b8',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_ticket_labels (
    ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES kanban_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, label_id)
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
  createLabel,
  findLabelsByProjectId,
  findLabelsByTicketId,
  findLabelById,
  updateLabel,
  deleteLabel,
  addTicketLabel,
  removeTicketLabel,
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

describe('Label repository', () => {
  it('createLabel creates a label in project', () => {
    const { project } = createTestProject();

    const label = createLabel(project.id, 'Bug', '#ef4444');

    expect(label).toBeDefined();
    expect(label.id).toBe(1);
    expect(label.project_id).toBe(project.id);
    expect(label.name).toBe('Bug');
    expect(label.color).toBe('#ef4444');
  });

  it('findLabelsByProjectId returns labels', () => {
    const { project } = createTestProject();

    createLabel(project.id, 'Bug', '#ef4444');
    createLabel(project.id, 'Feature', '#22c55e');

    const labels = findLabelsByProjectId(project.id);
    expect(labels).toHaveLength(2);
    // Ordered by name ASC
    expect(labels[0].name).toBe('Bug');
    expect(labels[1].name).toBe('Feature');
  });

  it('findLabelsByProjectId returns empty for no labels', () => {
    const { project } = createTestProject();

    const labels = findLabelsByProjectId(project.id);
    expect(labels).toEqual([]);
  });

  it('updateLabel updates name', () => {
    const { project } = createTestProject();
    const label = createLabel(project.id, 'Oldd', '#ef4444');

    const updated = updateLabel(label.id, { name: 'Fixed' });

    expect(updated).toBeDefined();
    expect(updated!.name).toBe('Fixed');
    expect(updated!.color).toBe('#ef4444');
  });

  it('updateLabel updates color', () => {
    const { project } = createTestProject();
    const label = createLabel(project.id, 'Bug', '#ef4444');

    const updated = updateLabel(label.id, { color: '#3b82f6' });

    expect(updated).toBeDefined();
    expect(updated!.color).toBe('#3b82f6');
    expect(updated!.name).toBe('Bug');
  });

  it('deleteLabel removes label', () => {
    const { project } = createTestProject();
    const label = createLabel(project.id, 'Temp', '#94a3b8');

    expect(findLabelById(label.id)).toBeDefined();

    deleteLabel(label.id);

    expect(findLabelById(label.id)).toBeUndefined();
  });

  it('addTicketLabel associates label with ticket', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const label = createLabel(project.id, 'Bug', '#ef4444');

    addTicketLabel(ticket.id, label.id);

    const labels = findLabelsByTicketId(ticket.id);
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe('Bug');
  });

  it('removeTicketLabel dissociates label', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const label = createLabel(project.id, 'Bug', '#ef4444');

    addTicketLabel(ticket.id, label.id);
    expect(findLabelsByTicketId(ticket.id)).toHaveLength(1);

    removeTicketLabel(ticket.id, label.id);
    expect(findLabelsByTicketId(ticket.id)).toHaveLength(0);
  });

  it('findLabelsByTicketId returns associated labels', () => {
    const { user, project } = createTestProject();
    const ticket = createTicket({ title: 'Test ticket' }, user.id, project.id);
    const label1 = createLabel(project.id, 'Bug', '#ef4444');
    const label2 = createLabel(project.id, 'Feature', '#22c55e');

    addTicketLabel(ticket.id, label1.id);
    addTicketLabel(ticket.id, label2.id);

    const labels = findLabelsByTicketId(ticket.id);
    expect(labels).toHaveLength(2);
    const names = labels.map(l => l.name);
    expect(names).toContain('Bug');
    expect(names).toContain('Feature');
  });
});
