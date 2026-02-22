import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// ── Migration SQL ────────────────────────────────────────────────────────────

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

  CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_slug ON kanban_projects(owner_id, slug);

  CREATE TABLE IF NOT EXISTS kanban_project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES auth_users(id),
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS kanban_project_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invited_by INTEGER NOT NULL REFERENCES auth_users(id),
    token TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_file_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    locked_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    message TEXT,
    activity_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_status_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kanban_deploy_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE REFERENCES kanban_projects(id) ON DELETE CASCADE,
    cf_project_name TEXT,
    cf_site_url TEXT,
    cf_api_token TEXT,
    cf_account_id TEXT,
    supabase_tenant_id TEXT,
    custom_domain TEXT,
    production_manifest TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

// ── Mock DB ──────────────────────────────────────────────────────────────────

let testDb: InstanceType<typeof Database>;

vi.mock('../db/sqlite', () => {
  return {
    default: null as unknown as InstanceType<typeof Database>,
  };
});

import * as sqliteMock from '../db/sqlite';

import {
  createProject,
  findProjectById,
  findProjectsByUserId,
  updateProject,
  deleteProject,
  findProjectByOwnerAndSlug,
  findProjectMember,
  findProjectMembers,
  insertProjectMember,
  updateProjectMemberRole,
  deleteProjectMember,
  countProjectMembers,
  createInvitation,
  findInvitationByToken,
  findPendingInvitationsByEmail,
  findPendingInvitationsByProject,
  updateInvitationStatus,
  deleteInvitation,
  findExistingInvitation,
  isTicketInProject,
  getAnalyticsForProject,
  findFileLocksForProject,
  createUser,
  createTicket,
} from '../db/repositories';

import { hasMinRole, canModifyTicket, canLaunchPipeline } from '../permissions';

import {
  createProjectSchema,
  updateProjectSchema,
  inviteMemberSchema,
  changeMemberRoleSchema,
  transferOwnershipSchema,
} from '../schemas';

// ── Helper ───────────────────────────────────────────────────────────────────

function createTestUser(email = 'alice@example.com') {
  return createUser(email);
}

function createTestProject(ownerId: number, name = 'Test Project', slug = 'test-project') {
  return createProject(name, '', slug, ownerId, 1, 'main-site');
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(MIGRATION_SQL);
  (sqliteMock as any).default = testDb;
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORIES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Projects CRUD ────────────────────────────────────────────────────────────

describe('Project repository', () => {
  describe('createProject', () => {
    it('creates a project and returns it', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);

      expect(project).toBeDefined();
      expect(project.id).toBe(1);
      expect(project.name).toBe('Test Project');
      expect(project.slug).toBe('test-project');
      expect(project.owner_id).toBe(user.id);
      expect(project.is_private).toBe(1);
      expect(project.default_repo).toBe('main-site');
    });

    it('auto-inserts the owner as a member with role owner', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);

      const member = findProjectMember(project.id, user.id);
      expect(member).toBeDefined();
      expect(member!.role).toBe('owner');
    });
  });

  describe('findProjectById', () => {
    it('finds a project by id', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);

      const found = findProjectById(project.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Project');
    });

    it('returns undefined for non-existent id', () => {
      expect(findProjectById(999)).toBeUndefined();
    });
  });

  describe('findProjectsByUserId', () => {
    it('returns projects the user is a member of with role', () => {
      const user = createTestUser();
      createTestProject(user.id, 'Project A', 'project-a');
      createTestProject(user.id, 'Project B', 'project-b');

      const projects = findProjectsByUserId(user.id);
      expect(projects).toHaveLength(2);
      expect(projects[0].role).toBe('owner');
    });

    it('returns empty array for user with no projects', () => {
      const user = createTestUser();
      expect(findProjectsByUserId(user.id)).toHaveLength(0);
    });

    it('includes projects where user is a member (not just owner)', () => {
      const owner = createTestUser('owner@example.com');
      const member = createTestUser('member@example.com');
      const project = createTestProject(owner.id);
      insertProjectMember(project.id, member.id, 'member');

      const memberProjects = findProjectsByUserId(member.id);
      expect(memberProjects).toHaveLength(1);
      expect(memberProjects[0].role).toBe('member');
    });
  });

  describe('updateProject', () => {
    it('updates project name', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);

      const updated = updateProject(project.id, { name: 'Renamed' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Renamed');
    });

    it('updates multiple fields', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);

      const updated = updateProject(project.id, {
        name: 'New Name',
        description: 'New description',
        is_private: 0,
        default_repo: 'other-repo',
      });

      expect(updated!.name).toBe('New Name');
      expect(updated!.description).toBe('New description');
      expect(updated!.is_private).toBe(0);
      expect(updated!.default_repo).toBe('other-repo');
    });

    it('returns undefined for empty fields', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);

      const result = updateProject(project.id, {});
      expect(result).toBeUndefined();
    });
  });

  describe('deleteProject', () => {
    it('deletes a project and its tickets', () => {
      const user = createTestUser();
      const project = createTestProject(user.id);
      createTicket({ title: 'Ticket in project' }, user.id, project.id);

      deleteProject(project.id);

      expect(findProjectById(project.id)).toBeUndefined();
    });

    it('does not throw when deleting non-existent project', () => {
      expect(() => deleteProject(999)).not.toThrow();
    });
  });

  describe('findProjectByOwnerAndSlug', () => {
    it('finds a project by owner and slug', () => {
      const user = createTestUser();
      createTestProject(user.id);

      const found = findProjectByOwnerAndSlug(user.id, 'test-project');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Project');
    });

    it('returns undefined for wrong slug', () => {
      const user = createTestUser();
      createTestProject(user.id);

      expect(findProjectByOwnerAndSlug(user.id, 'wrong-slug')).toBeUndefined();
    });

    it('returns undefined for wrong owner', () => {
      const user = createTestUser();
      createTestProject(user.id);

      expect(findProjectByOwnerAndSlug(999, 'test-project')).toBeUndefined();
    });
  });
});

// ── Project Members ──────────────────────────────────────────────────────────

describe('Project Members repository', () => {
  describe('insertProjectMember + findProjectMember', () => {
    it('inserts a member and finds them', () => {
      const owner = createTestUser('owner@example.com');
      const member = createTestUser('member@example.com');
      const project = createTestProject(owner.id);

      const inserted = insertProjectMember(project.id, member.id, 'member');
      expect(inserted).toBeDefined();
      expect(inserted.role).toBe('member');

      const found = findProjectMember(project.id, member.id);
      expect(found).toBeDefined();
      expect(found!.user_id).toBe(member.id);
    });

    it('findProjectMember returns undefined for non-member', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);

      expect(findProjectMember(project.id, 999)).toBeUndefined();
    });
  });

  describe('findProjectMembers', () => {
    it('returns all members with email', () => {
      const owner = createTestUser('owner@example.com');
      const member = createTestUser('member@example.com');
      const project = createTestProject(owner.id);
      insertProjectMember(project.id, member.id, 'member');

      const members = findProjectMembers(project.id);
      expect(members).toHaveLength(2);
      expect(members.some(m => m.email === 'owner@example.com')).toBe(true);
      expect(members.some(m => m.email === 'member@example.com')).toBe(true);
    });

    it('returns empty array for non-existent project', () => {
      expect(findProjectMembers(999)).toHaveLength(0);
    });
  });

  describe('updateProjectMemberRole', () => {
    it('changes a member role', () => {
      const owner = createTestUser('owner@example.com');
      const member = createTestUser('member@example.com');
      const project = createTestProject(owner.id);
      insertProjectMember(project.id, member.id, 'member');

      updateProjectMemberRole(project.id, member.id, 'admin');

      const found = findProjectMember(project.id, member.id);
      expect(found!.role).toBe('admin');
    });
  });

  describe('deleteProjectMember', () => {
    it('removes a member', () => {
      const owner = createTestUser('owner@example.com');
      const member = createTestUser('member@example.com');
      const project = createTestProject(owner.id);
      insertProjectMember(project.id, member.id, 'member');

      deleteProjectMember(project.id, member.id);

      expect(findProjectMember(project.id, member.id)).toBeUndefined();
    });

    it('does not throw when removing non-existent member', () => {
      expect(() => deleteProjectMember(1, 999)).not.toThrow();
    });
  });

  describe('countProjectMembers', () => {
    it('returns correct count', () => {
      const owner = createTestUser('owner@example.com');
      const member = createTestUser('member@example.com');
      const project = createTestProject(owner.id);
      insertProjectMember(project.id, member.id, 'member');

      expect(countProjectMembers(project.id)).toBe(2); // owner + member
    });

    it('returns 0 for non-existent project', () => {
      expect(countProjectMembers(999)).toBe(0);
    });
  });
});

// ── Project Invitations ──────────────────────────────────────────────────────

describe('Project Invitations repository', () => {
  const futureDate = '2099-01-01T00:00:00';
  const pastDate = '2020-01-01T00:00:00';

  describe('createInvitation + findInvitationByToken', () => {
    it('creates an invitation and finds it by token', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);

      const inv = createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'abc123', futureDate);
      expect(inv).toBeDefined();
      expect(inv.email).toBe('guest@example.com');
      expect(inv.role).toBe('member');
      expect(inv.status).toBe('pending');

      const found = findInvitationByToken('abc123');
      expect(found).toBeDefined();
      expect(found!.id).toBe(inv.id);
    });

    it('findInvitationByToken returns undefined for non-existent token', () => {
      expect(findInvitationByToken('nonexistent')).toBeUndefined();
    });
  });

  describe('findPendingInvitationsByEmail', () => {
    it('returns pending invitations for a specific email', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'token1', futureDate);
      createInvitation(project.id, 'other@example.com', 'member', owner.id, 'token2', futureDate);

      const invitations = findPendingInvitationsByEmail('guest@example.com');
      expect(invitations).toHaveLength(1);
      expect(invitations[0].project_name).toBe('Test Project');
      expect(invitations[0].inviter_email).toBe('alice@example.com');
    });

    it('does not return expired invitations', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'expired-token', pastDate);

      const invitations = findPendingInvitationsByEmail('guest@example.com');
      expect(invitations).toHaveLength(0);
    });

    it('does not return accepted invitations', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      const inv = createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'accepted-token', futureDate);
      updateInvitationStatus(inv.id, 'accepted');

      const invitations = findPendingInvitationsByEmail('guest@example.com');
      expect(invitations).toHaveLength(0);
    });
  });

  describe('findPendingInvitationsByProject', () => {
    it('returns pending invitations for a project', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      createInvitation(project.id, 'a@example.com', 'member', owner.id, 'tok1', futureDate);
      createInvitation(project.id, 'b@example.com', 'admin', owner.id, 'tok2', futureDate);

      const invitations = findPendingInvitationsByProject(project.id);
      expect(invitations).toHaveLength(2);
    });

    it('excludes expired invitations', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      createInvitation(project.id, 'a@example.com', 'member', owner.id, 'tok-expired', pastDate);

      expect(findPendingInvitationsByProject(project.id)).toHaveLength(0);
    });
  });

  describe('updateInvitationStatus', () => {
    it('updates invitation status', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      const inv = createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'tok', futureDate);

      updateInvitationStatus(inv.id, 'accepted');

      const found = findInvitationByToken('tok');
      expect(found!.status).toBe('accepted');
    });
  });

  describe('deleteInvitation', () => {
    it('deletes an invitation', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      const inv = createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'del-tok', futureDate);

      deleteInvitation(inv.id);

      expect(findInvitationByToken('del-tok')).toBeUndefined();
    });
  });

  describe('findExistingInvitation', () => {
    it('finds an existing pending invitation for the same email and project', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'dup-tok', futureDate);

      const existing = findExistingInvitation(project.id, 'guest@example.com');
      expect(existing).toBeDefined();
      expect(existing!.email).toBe('guest@example.com');
    });

    it('returns undefined if no pending invitation exists', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);

      expect(findExistingInvitation(project.id, 'nobody@example.com')).toBeUndefined();
    });

    it('returns undefined for expired invitations', () => {
      const owner = createTestUser();
      const project = createTestProject(owner.id);
      createInvitation(project.id, 'guest@example.com', 'member', owner.id, 'exp-tok', pastDate);

      expect(findExistingInvitation(project.id, 'guest@example.com')).toBeUndefined();
    });
  });
});

// ── Ticket-Project scoping ───────────────────────────────────────────────────

describe('isTicketInProject', () => {
  it('returns true when ticket belongs to the project', () => {
    const user = createTestUser();
    const project = createTestProject(user.id);
    const ticket = createTicket({ title: 'Scoped ticket' }, user.id, project.id);

    expect(isTicketInProject(ticket.id, project.id)).toBe(true);
  });

  it('returns false when ticket belongs to a different project', () => {
    const user = createTestUser();
    const p1 = createTestProject(user.id, 'P1', 'p1');
    const p2 = createTestProject(user.id, 'P2', 'p2');
    const ticket = createTicket({ title: 'Ticket in P1' }, user.id, p1.id);

    expect(isTicketInProject(ticket.id, p2.id)).toBe(false);
  });

  it('returns false for non-existent ticket', () => {
    expect(isTicketInProject(999, 1)).toBe(false);
  });
});

// ── Analytics (project-scoped) ───────────────────────────────────────────────

describe('getAnalyticsForProject', () => {
  it('returns analytics for a project with tickets', () => {
    const user = createTestUser();
    const project = createTestProject(user.id);
    createTicket({ title: 'T1', priority: 'high' }, user.id, project.id);
    createTicket({ title: 'T2', priority: 'low' }, user.id, project.id);

    const analytics = getAnalyticsForProject(project.id);
    expect(analytics.total).toBe(2);
    expect(analytics.byPriority).toHaveLength(2);
  });

  it('returns zero analytics for project with no tickets', () => {
    const user = createTestUser();
    const project = createTestProject(user.id);

    const analytics = getAnalyticsForProject(project.id);
    expect(analytics.total).toBe(0);
    expect(analytics.tokensTotal).toBe(0);
    expect(analytics.costTotal).toBe(0);
  });
});

// ── File Locks (project-scoped) ──────────────────────────────────────────────

describe('findFileLocksForProject', () => {
  it('returns file locks for tickets in the project', () => {
    const user = createTestUser();
    const project = createTestProject(user.id);
    const ticket = createTicket({ title: 'Locked ticket' }, user.id, project.id);

    testDb.prepare('INSERT INTO kanban_file_locks (file_path, ticket_id) VALUES (?, ?)').run('src/app.php', ticket.id);

    const locks = findFileLocksForProject(project.id);
    expect(locks).toHaveLength(1);
    expect(locks[0].file_path).toBe('src/app.php');
  });

  it('returns empty array for project with no locks', () => {
    const user = createTestUser();
    const project = createTestProject(user.id);

    expect(findFileLocksForProject(project.id)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Permissions', () => {
  describe('hasMinRole', () => {
    it('owner >= all roles', () => {
      expect(hasMinRole('owner', 'owner')).toBe(true);
      expect(hasMinRole('owner', 'admin')).toBe(true);
      expect(hasMinRole('owner', 'member')).toBe(true);
      expect(hasMinRole('owner', 'viewer')).toBe(true);
    });

    it('admin >= admin, member, viewer but not owner', () => {
      expect(hasMinRole('admin', 'owner')).toBe(false);
      expect(hasMinRole('admin', 'admin')).toBe(true);
      expect(hasMinRole('admin', 'member')).toBe(true);
      expect(hasMinRole('admin', 'viewer')).toBe(true);
    });

    it('member >= member, viewer but not admin/owner', () => {
      expect(hasMinRole('member', 'owner')).toBe(false);
      expect(hasMinRole('member', 'admin')).toBe(false);
      expect(hasMinRole('member', 'member')).toBe(true);
      expect(hasMinRole('member', 'viewer')).toBe(true);
    });

    it('viewer >= viewer only', () => {
      expect(hasMinRole('viewer', 'owner')).toBe(false);
      expect(hasMinRole('viewer', 'admin')).toBe(false);
      expect(hasMinRole('viewer', 'member')).toBe(false);
      expect(hasMinRole('viewer', 'viewer')).toBe(true);
    });
  });

  describe('canModifyTicket', () => {
    const ownTicket = { user_id: 10 } as any;
    const otherTicket = { user_id: 99 } as any;

    it('owner can modify any ticket', () => {
      expect(canModifyTicket(ownTicket, 10, 'owner')).toBe(true);
      expect(canModifyTicket(otherTicket, 10, 'owner')).toBe(true);
    });

    it('admin can modify any ticket', () => {
      expect(canModifyTicket(otherTicket, 10, 'admin')).toBe(true);
    });

    it('member can only modify their own ticket', () => {
      expect(canModifyTicket(ownTicket, 10, 'member')).toBe(true);
      expect(canModifyTicket(otherTicket, 10, 'member')).toBe(false);
    });

    it('viewer cannot modify any ticket', () => {
      expect(canModifyTicket(ownTicket, 10, 'viewer')).toBe(false);
    });
  });

  describe('canLaunchPipeline', () => {
    const ownTicket = { user_id: 10 } as any;
    const otherTicket = { user_id: 99 } as any;

    it('owner can launch pipeline for any ticket', () => {
      expect(canLaunchPipeline(ownTicket, 10, 'owner')).toBe(true);
      expect(canLaunchPipeline(otherTicket, 10, 'owner')).toBe(true);
    });

    it('admin can launch pipeline for any ticket', () => {
      expect(canLaunchPipeline(otherTicket, 10, 'admin')).toBe(true);
    });

    it('member can only launch pipeline for own ticket', () => {
      expect(canLaunchPipeline(ownTicket, 10, 'member')).toBe(true);
      expect(canLaunchPipeline(otherTicket, 10, 'member')).toBe(false);
    });

    it('viewer cannot launch pipeline', () => {
      expect(canLaunchPipeline(ownTicket, 10, 'viewer')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Project schemas', () => {
  describe('createProjectSchema', () => {
    it('accepts valid input with all fields', () => {
      const result = createProjectSchema.safeParse({
        name: 'My Project',
        slug: 'my-project',
        description: 'A cool project',
        is_private: 0,
        default_repo: 'repo-name',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('My Project');
        expect(result.data.slug).toBe('my-project');
        expect(result.data.is_private).toBe(0);
      }
    });

    it('applies defaults for optional fields', () => {
      const result = createProjectSchema.safeParse({ name: 'Min', slug: 'min' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('');
        expect(result.data.is_private).toBe(1);
        expect(result.data.default_repo).toBe('main-site');
      }
    });

    it('rejects name shorter than 2 characters', () => {
      const result = createProjectSchema.safeParse({ name: 'A', slug: 'aa' });
      expect(result.success).toBe(false);
    });

    it('rejects name longer than 100 characters', () => {
      const result = createProjectSchema.safeParse({ name: 'A'.repeat(101), slug: 'valid' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid slug (uppercase)', () => {
      const result = createProjectSchema.safeParse({ name: 'Valid', slug: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid slug (spaces)', () => {
      const result = createProjectSchema.safeParse({ name: 'Valid', slug: 'has space' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid slug (starts with dash)', () => {
      const result = createProjectSchema.safeParse({ name: 'Valid', slug: '-invalid' });
      expect(result.success).toBe(false);
    });

    it('accepts valid slug with digits and dashes', () => {
      const result = createProjectSchema.safeParse({ name: 'Valid', slug: 'my-project-123' });
      expect(result.success).toBe(true);
    });

    it('rejects is_private outside 0-1 range', () => {
      const result = createProjectSchema.safeParse({ name: 'Valid', slug: 'valid', is_private: 2 });
      expect(result.success).toBe(false);
    });

    it('rejects description longer than 500 characters', () => {
      const result = createProjectSchema.safeParse({ name: 'Valid', slug: 'valid', description: 'D'.repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe('updateProjectSchema', () => {
    it('accepts partial update with name', () => {
      const result = updateProjectSchema.safeParse({ name: 'New name' });
      expect(result.success).toBe(true);
    });

    it('accepts partial update with is_private', () => {
      const result = updateProjectSchema.safeParse({ is_private: 0 });
      expect(result.success).toBe(true);
    });

    it('rejects empty object', () => {
      const result = updateProjectSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const msg = result.error.issues.map(i => i.message).join(' ');
        expect(msg).toContain('At least one field required');
      }
    });

    it('rejects name shorter than 2 characters', () => {
      const result = updateProjectSchema.safeParse({ name: 'A' });
      expect(result.success).toBe(false);
    });
  });

  describe('inviteMemberSchema', () => {
    it('accepts valid email with default role', () => {
      const result = inviteMemberSchema.safeParse({ email: 'user@example.com' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('accepts valid email with explicit role', () => {
      const result = inviteMemberSchema.safeParse({ email: 'user@example.com', role: 'admin' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = inviteMemberSchema.safeParse({ email: 'not-email' });
      expect(result.success).toBe(false);
    });

    it('rejects owner role (cannot invite as owner)', () => {
      const result = inviteMemberSchema.safeParse({ email: 'user@example.com', role: 'owner' });
      expect(result.success).toBe(false);
    });

    it('accepts all valid roles', () => {
      for (const role of ['admin', 'member', 'viewer']) {
        const result = inviteMemberSchema.safeParse({ email: 'user@example.com', role });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('changeMemberRoleSchema', () => {
    it('accepts valid role', () => {
      const result = changeMemberRoleSchema.safeParse({ role: 'admin' });
      expect(result.success).toBe(true);
    });

    it('rejects owner role', () => {
      const result = changeMemberRoleSchema.safeParse({ role: 'owner' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const result = changeMemberRoleSchema.safeParse({ role: 'superadmin' });
      expect(result.success).toBe(false);
    });

    it('rejects missing role', () => {
      const result = changeMemberRoleSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('transferOwnershipSchema', () => {
    it('accepts valid positive integer', () => {
      const result = transferOwnershipSchema.safeParse({ new_owner_id: 5 });
      expect(result.success).toBe(true);
    });

    it('rejects zero', () => {
      const result = transferOwnershipSchema.safeParse({ new_owner_id: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative number', () => {
      const result = transferOwnershipSchema.safeParse({ new_owner_id: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer', () => {
      const result = transferOwnershipSchema.safeParse({ new_owner_id: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing field', () => {
      const result = transferOwnershipSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
