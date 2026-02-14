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

  CREATE TABLE IF NOT EXISTS kanban_ticket_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title_template TEXT DEFAULT '',
    description_template TEXT DEFAULT '',
    priority TEXT DEFAULT 'medium',
    template TEXT DEFAULT 'feature',
    tags TEXT DEFAULT '[]',
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
  createTemplate,
  findTemplatesByProjectId,
  findTemplateById,
  updateTemplate,
  deleteTemplate,
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

describe('Template repository', () => {
  it('createTemplate creates a template', () => {
    const { project } = createTestProject();

    const template = createTemplate(project.id, { name: 'Bug Report' });

    expect(template).toBeDefined();
    expect(template.id).toBe(1);
    expect(template.project_id).toBe(project.id);
    expect(template.name).toBe('Bug Report');
    expect(template.priority).toBe('medium');
    expect(template.template).toBe('feature');
    expect(template.title_template).toBe('');
    expect(template.description_template).toBe('');
  });

  it('findTemplatesByProjectId returns templates', () => {
    const { project } = createTestProject();

    createTemplate(project.id, { name: 'Bug Report' });
    createTemplate(project.id, { name: 'Feature Request' });

    const templates = findTemplatesByProjectId(project.id);
    expect(templates).toHaveLength(2);
  });

  it('findTemplateById returns a template', () => {
    const { project } = createTestProject();
    const created = createTemplate(project.id, { name: 'Bug Report' });

    const found = findTemplateById(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Bug Report');
  });

  it('findTemplateById returns undefined for non-existent', () => {
    expect(findTemplateById(999)).toBeUndefined();
  });

  it('updateTemplate updates fields', () => {
    const { project } = createTestProject();
    const template = createTemplate(project.id, { name: 'Old Name' });

    const updated = updateTemplate(template.id, {
      name: 'New Name',
      priority: 'high',
      title_template: '[BUG] ',
    });

    expect(updated).toBeDefined();
    expect(updated!.name).toBe('New Name');
    expect(updated!.priority).toBe('high');
    expect(updated!.title_template).toBe('[BUG] ');
  });

  it('deleteTemplate removes template', () => {
    const { project } = createTestProject();
    const template = createTemplate(project.id, { name: 'Temp' });

    expect(findTemplateById(template.id)).toBeDefined();

    deleteTemplate(template.id);

    expect(findTemplateById(template.id)).toBeUndefined();
  });

  it('createTemplate with tags stores as JSON', () => {
    const { project } = createTestProject();

    const template = createTemplate(project.id, {
      name: 'Tagged Template',
      tags: ['frontend', 'urgent'],
    });

    expect(template.tags).toBe(JSON.stringify(['frontend', 'urgent']));

    // Verify via findTemplateById
    const found = findTemplateById(template.id);
    expect(found).toBeDefined();
    const parsedTags = JSON.parse(found!.tags);
    expect(parsedTags).toEqual(['frontend', 'urgent']);
  });
});
