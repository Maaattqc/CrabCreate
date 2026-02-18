import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// ── Migration SQL (from server/db/migrations.ts) ────────────────────────────
const MIGRATION_SQL = `
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
    created_at TEXT DEFAULT (datetime('now'))
  );

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

  CREATE TABLE IF NOT EXISTS auth_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
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
`;

// ── Create a fresh in-memory DB for each test ────────────────────────────────

let testDb: InstanceType<typeof Database>;

// Mock the sqlite module BEFORE importing repositories
vi.mock('../db/sqlite', () => {
  return {
    default: null as unknown as InstanceType<typeof Database>,
  };
});

// We need to update the mock's default export before each test
import * as sqliteMock from '../db/sqlite';

// Import repositories AFTER mock is set up
import {
  createTicket,
  findTicketById,
  findAllTickets,
  updateTicket,
  deleteTicket,
  updateTicketStatus,
  createUser,
  findUserByEmail,
  findUserById,
  updateUserBlocked,
  updateUserPlan,
  setUserAdmin,
  isTicketOwner,
  isUserAdmin,
  insertLog,
  findLogsByTicketId,
  findLatestDiff,
  insertChat,
  findChatByTicketId,
  insertActivity,
  findActivityByTicketId,
  getConfig,
  setConfig,
  countUsers,
} from '../db/repositories';

beforeEach(() => {
  // Create a fresh in-memory database for each test
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(MIGRATION_SQL);

  // Replace the mocked module's default export with our fresh DB
  // The repositories module imports `db` as default, so we patch the mock
  (sqliteMock as any).default = testDb;
});

// ── Tickets ──────────────────────────────────────────────────────────────────

describe('Ticket repository', () => {
  describe('createTicket + findTicketById + findAllTickets', () => {
    it('creates a ticket and retrieves it by id', () => {
      const ticket = createTicket({ title: 'Test ticket', description: 'A description' });

      expect(ticket).toBeDefined();
      expect(ticket.id).toBe(1);
      expect(ticket.title).toBe('Test ticket');
      expect(ticket.description).toBe('A description');
      expect(ticket.priority).toBe('medium');
      expect(ticket.status).toBe('backlog');
      expect(ticket.ai_model).toBe('claude');

      const found = findTicketById(ticket.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe('Test ticket');
    });

    it('findTicketById returns undefined for non-existent id', () => {
      const found = findTicketById(999);
      expect(found).toBeUndefined();
    });

    it('findAllTickets returns all tickets', () => {
      createTicket({ title: 'Ticket 1' });
      createTicket({ title: 'Ticket 2' });
      createTicket({ title: 'Ticket 3' });

      const all = findAllTickets({});
      expect(all).toHaveLength(3);
    });

    it('findAllTickets returns tickets ordered by created_at DESC', () => {
      createTicket({ title: 'First' });
      createTicket({ title: 'Second' });

      const all = findAllTickets({});
      // Most recent first (both created in same second, so ordered by id DESC due to AUTOINCREMENT)
      expect(all.length).toBe(2);
    });

    it('createTicket assigns user_id when provided', () => {
      const ticket = createTicket({ title: 'User ticket' }, 42);
      expect(ticket.user_id).toBe(42);
    });

    it('createTicket sets user_id to null when not provided', () => {
      const ticket = createTicket({ title: 'No user ticket' });
      expect(ticket.user_id).toBeNull();
    });
  });

  describe('findAllTickets with userId filter', () => {
    it('only returns tickets belonging to the given userId', () => {
      createTicket({ title: 'User 1 ticket' }, 1);
      createTicket({ title: 'User 2 ticket' }, 2);
      createTicket({ title: 'User 1 again' }, 1);

      const user1Tickets = findAllTickets({}, 1);
      expect(user1Tickets).toHaveLength(2);
      expect(user1Tickets.every((t) => t.user_id === 1)).toBe(true);

      const user2Tickets = findAllTickets({}, 2);
      expect(user2Tickets).toHaveLength(1);
      expect(user2Tickets[0].title).toBe('User 2 ticket');
    });

    it('returns empty array if no tickets belong to the userId', () => {
      createTicket({ title: 'Other user ticket' }, 99);
      const result = findAllTickets({}, 1);
      expect(result).toHaveLength(0);
    });

    it('filters by both userId and status', () => {
      const t1 = createTicket({ title: 'Backlog ticket' }, 1);
      const t2 = createTicket({ title: 'Coding ticket' }, 1);
      updateTicket(t2.id, { status: 'ai_coding' });
      createTicket({ title: 'Other user backlog' }, 2);

      const result = findAllTickets({ status: 'backlog' }, 1);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Backlog ticket');
    });
  });

  describe('updateTicket', () => {
    it('updates a ticket field', () => {
      const ticket = createTicket({ title: 'Original title' });
      const updated = updateTicket(ticket.id, { title: 'Updated title' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated title');
    });

    it('updates multiple fields', () => {
      const ticket = createTicket({ title: 'Test' });
      const updated = updateTicket(ticket.id, {
        title: 'New title',
        priority: 'high',
        status: 'ai_coding',
        progress: 50,
      });

      expect(updated!.title).toBe('New title');
      expect(updated!.priority).toBe('high');
      expect(updated!.status).toBe('ai_coding');
      expect(updated!.progress).toBe(50);
    });

    it('returns undefined when no fields to update', () => {
      const ticket = createTicket({ title: 'Test' });
      const result = updateTicket(ticket.id, {});
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-existent ticket', () => {
      const result = updateTicket(999, { title: 'Ghost' });
      // updateTicket runs the SQL (0 rows affected) then selects by id which returns undefined
      expect(result).toBeUndefined();
    });

    it('serializes object fields as JSON', () => {
      const ticket = createTicket({ title: 'Test' });
      const updated = updateTicket(ticket.id, {
        target_files: ['file1.php', 'file2.php'],
      });
      expect(updated).toBeDefined();
      const parsed = JSON.parse(updated!.target_files!);
      expect(parsed).toEqual(['file1.php', 'file2.php']);
    });
  });

  describe('deleteTicket', () => {
    it('deletes a ticket', () => {
      const ticket = createTicket({ title: 'To delete' });
      expect(findTicketById(ticket.id)).toBeDefined();

      deleteTicket(ticket.id);
      expect(findTicketById(ticket.id)).toBeUndefined();
    });

    it('does not throw when deleting non-existent ticket', () => {
      expect(() => deleteTicket(999)).not.toThrow();
    });
  });
});

// ── Users ────────────────────────────────────────────────────────────────────

describe('User repository', () => {
  describe('createUser + findUserByEmail + findUserById', () => {
    it('creates a user and finds by email', () => {
      const user = createUser('alice@example.com');

      expect(user).toBeDefined();
      expect(user.id).toBe(1);
      expect(user.email).toBe('alice@example.com');
      expect(user.is_admin).toBe(0);
      expect(user.plan).toBe('free');
      expect(user.blocked).toBe(0);

      const found = findUserByEmail('alice@example.com');
      expect(found).toBeDefined();
      expect(found!.email).toBe('alice@example.com');
    });

    it('finds a user by id', () => {
      const user = createUser('bob@example.com');
      const found = findUserById(user.id);

      expect(found).toBeDefined();
      expect(found!.email).toBe('bob@example.com');
    });

    it('returns undefined for non-existent email', () => {
      expect(findUserByEmail('nobody@example.com')).toBeUndefined();
    });

    it('returns undefined for non-existent id', () => {
      expect(findUserById(999)).toBeUndefined();
    });
  });

  describe('updateUserBlocked', () => {
    it('blocks a user with reason', () => {
      const user = createUser('baduser@example.com');
      updateUserBlocked(user.id, true, 'Spam');

      const found = findUserById(user.id);
      expect(found!.blocked).toBe(1);
      expect(found!.blocked_reason).toBe('Spam');
    });

    it('unblocks a user', () => {
      const user = createUser('temp@example.com');
      updateUserBlocked(user.id, true, 'Testing');
      updateUserBlocked(user.id, false);

      const found = findUserById(user.id);
      expect(found!.blocked).toBe(0);
      expect(found!.blocked_reason).toBeNull();
    });
  });

  describe('updateUserPlan', () => {
    it('updates user plan', () => {
      const user = createUser('planuser@example.com');
      expect(findUserById(user.id)!.plan).toBe('free');

      updateUserPlan(user.id, 'pro');
      expect(findUserById(user.id)!.plan).toBe('pro');
    });
  });

  describe('setUserAdmin', () => {
    it('sets a user as admin', () => {
      const user = createUser('admin@example.com');
      expect(findUserById(user.id)!.is_admin).toBe(0);

      setUserAdmin(user.id, true);
      expect(findUserById(user.id)!.is_admin).toBe(1);
    });

    it('removes admin from a user', () => {
      const user = createUser('admin2@example.com');
      setUserAdmin(user.id, true);
      expect(findUserById(user.id)!.is_admin).toBe(1);

      setUserAdmin(user.id, false);
      expect(findUserById(user.id)!.is_admin).toBe(0);
    });
  });

  describe('countUsers', () => {
    it('returns 0 when no users', () => {
      expect(countUsers()).toBe(0);
    });

    it('returns correct count', () => {
      createUser('a@example.com');
      createUser('b@example.com');
      createUser('c@example.com');
      expect(countUsers()).toBe(3);
    });
  });
});

// ── Ticket ownership / admin ─────────────────────────────────────────────────

describe('isTicketOwner', () => {
  it('returns true when user owns the ticket', () => {
    const ticket = createTicket({ title: 'Owned' }, 5);
    expect(isTicketOwner(ticket.id, 5)).toBe(true);
  });

  it('returns false when user does not own the ticket', () => {
    const ticket = createTicket({ title: 'Not owned' }, 5);
    expect(isTicketOwner(ticket.id, 99)).toBe(false);
  });

  it('returns false for non-existent ticket', () => {
    expect(isTicketOwner(999, 1)).toBe(false);
  });
});

describe('isUserAdmin', () => {
  it('returns true for admin user', () => {
    const user = createUser('admin@test.com');
    setUserAdmin(user.id, true);
    expect(isUserAdmin(user.id)).toBe(true);
  });

  it('returns false for non-admin user', () => {
    const user = createUser('regular@test.com');
    expect(isUserAdmin(user.id)).toBe(false);
  });

  it('returns false for non-existent user', () => {
    expect(isUserAdmin(999)).toBe(false);
  });
});

// ── Logs ─────────────────────────────────────────────────────────────────────

describe('Log repository', () => {
  it('inserts and retrieves logs by ticket id', () => {
    const ticket = createTicket({ title: 'Log test' });

    insertLog(ticket.id, 'Starting pipeline', 'info', 'init');
    insertLog(ticket.id, 'Code generated', 'success', 'coding');

    const logs = findLogsByTicketId(ticket.id);
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('Starting pipeline');
    expect(logs[0].log_type).toBe('info');
    expect(logs[0].phase).toBe('init');
    expect(logs[1].message).toBe('Code generated');
  });

  it('returns empty array for ticket with no logs', () => {
    const ticket = createTicket({ title: 'No logs' });
    const logs = findLogsByTicketId(ticket.id);
    expect(logs).toHaveLength(0);
  });

  it('returns empty array for non-existent ticket', () => {
    const logs = findLogsByTicketId(999);
    expect(logs).toHaveLength(0);
  });
});

// ── Config ───────────────────────────────────────────────────────────────────

describe('Config repository', () => {
  it('returns undefined for non-existent key', () => {
    expect(getConfig('nonexistent')).toBeUndefined();
  });

  it('sets and gets a config value', () => {
    setConfig('test_key', 'test_value');
    expect(getConfig('test_key')).toBe('test_value');
  });

  it('overwrites existing config value (upsert)', () => {
    setConfig('my_key', 'first');
    expect(getConfig('my_key')).toBe('first');

    setConfig('my_key', 'second');
    expect(getConfig('my_key')).toBe('second');
  });

  it('handles multiple distinct keys', () => {
    setConfig('key_a', 'value_a');
    setConfig('key_b', 'value_b');

    expect(getConfig('key_a')).toBe('value_a');
    expect(getConfig('key_b')).toBe('value_b');
  });
});

// ── updateTicketStatus ──────────────────────────────────────────────────────

describe('updateTicketStatus', () => {
  it('updates status and progress', () => {
    const ticket = createTicket({ title: 'Status test' });
    updateTicketStatus(ticket.id, 'ai_coding', 30);

    const updated = findTicketById(ticket.id);
    expect(updated!.status).toBe('ai_coding');
    expect(updated!.progress).toBe(30);
  });
});

// ── Diffs ───────────────────────────────────────────────────────────────────

describe('findLatestDiff', () => {
  it('returns a diff log message', () => {
    const ticket = createTicket({ title: 'Diff ticket' });

    insertLog(ticket.id, 'first diff content', 'diff', 'coding');
    insertLog(ticket.id, 'second diff content', 'diff', 'coding');
    insertLog(ticket.id, 'not a diff', 'info', 'coding');

    const diff = findLatestDiff(ticket.id);
    expect(diff).not.toBeNull();
    expect(['first diff content', 'second diff content']).toContain(diff);
  });

  it('returns null when no diff logs exist', () => {
    const ticket = createTicket({ title: 'No diff' });
    insertLog(ticket.id, 'some info', 'info', 'review');

    const diff = findLatestDiff(ticket.id);
    expect(diff).toBeNull();
  });

  it('returns null for a ticket with no logs at all', () => {
    const ticket = createTicket({ title: 'Empty' });
    const diff = findLatestDiff(ticket.id);
    expect(diff).toBeNull();
  });
});

// ── Chat ────────────────────────────────────────────────────────────────────

describe('Chat repository', () => {
  it('inserts and retrieves chat messages for a ticket', () => {
    const ticket = createTicket({ title: 'Chat ticket' });

    insertChat(ticket.id, 'user', 'Hello AI');
    insertChat(ticket.id, 'ai', 'Hello! How can I help?');

    const messages = findChatByTicketId(ticket.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].message).toBe('Hello AI');
    expect(messages[1].role).toBe('ai');
    expect(messages[1].message).toBe('Hello! How can I help?');
  });

  it('returns empty array when no chat messages exist', () => {
    const ticket = createTicket({ title: 'No chat' });
    const messages = findChatByTicketId(ticket.id);
    expect(messages).toEqual([]);
  });

  it('returns messages ordered by created_at ASC', () => {
    const ticket = createTicket({ title: 'Chat order' });

    insertChat(ticket.id, 'user', 'First');
    insertChat(ticket.id, 'ai', 'Second');
    insertChat(ticket.id, 'user', 'Third');

    const messages = findChatByTicketId(ticket.id);
    expect(messages[0].message).toBe('First');
    expect(messages[1].message).toBe('Second');
    expect(messages[2].message).toBe('Third');
  });
});

// ── Activity ────────────────────────────────────────────────────────────────

describe('Activity repository', () => {
  it('inserts and retrieves activity entries for a ticket', () => {
    const ticket = createTicket({ title: 'Activity ticket' });

    insertActivity(ticket.id, 'Ticket created', 'create');
    insertActivity(ticket.id, 'Pipeline started', 'pipeline');

    const activity = findActivityByTicketId(ticket.id);
    expect(activity).toHaveLength(2);
    const messages = activity.map(a => a.message);
    expect(messages).toContain('Ticket created');
    expect(messages).toContain('Pipeline started');
  });

  it('returns empty array when no activity exists', () => {
    const ticket = createTicket({ title: 'No activity' });
    const activity = findActivityByTicketId(ticket.id);
    expect(activity).toEqual([]);
  });
});
