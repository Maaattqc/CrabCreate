import db from './sqlite';
import config from '../config';
import {
  encryptSecret,
  hashAuthCode,
  isEncryptedSecret,
  isHashedAuthCode,
} from '../services/secrets';

function migrate(): void {
  db.exec(`
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
  `);

  // ── Collaboration tables ──

  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES auth_users(id),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kanban_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL REFERENCES kanban_comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES auth_users(id),
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(comment_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS kanban_watchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES auth_users(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(ticket_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS kanban_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES auth_users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      ticket_id INTEGER REFERENCES kanban_tickets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES kanban_projects(id) ON DELETE CASCADE,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── New feature tables ──

  db.exec(`
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

    CREATE TABLE IF NOT EXISTS kanban_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kanban_favorites (
      user_id INTEGER NOT NULL REFERENCES auth_users(id),
      ticket_id INTEGER NOT NULL REFERENCES kanban_tickets(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, ticket_id)
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

    CREATE TABLE IF NOT EXISTS kanban_user_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES kanban_projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      secret TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Indexes ──
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_owner_slug ON kanban_projects(owner_id, slug)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_comments_ticket ON kanban_comments(ticket_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_reactions_comment ON kanban_reactions(comment_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_watchers_ticket ON kanban_watchers(ticket_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_user ON kanban_notifications(user_id, read)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_labels_project ON kanban_labels(project_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_subtasks_ticket ON kanban_subtasks(ticket_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_favorites_user ON kanban_favorites(user_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_templates_project ON kanban_ticket_templates(project_id)");
  } catch { /* index may already exist */ }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_user_webhooks_project ON kanban_user_webhooks(project_id)");
  } catch { /* index may already exist */ }

  // ── Column migrations for existing DBs ──

  const ticketCols = db.prepare("PRAGMA table_info(kanban_tickets)").all() as { name: string }[];
  const ticketColNames = ticketCols.map(c => c.name);
  if (ticketCols.length > 0 && !ticketColNames.includes('user_id')) {
    db.exec("ALTER TABLE kanban_tickets ADD COLUMN user_id INTEGER");
  }
  if (ticketCols.length > 0 && !ticketColNames.includes('last_modified_by')) {
    db.exec("ALTER TABLE kanban_tickets ADD COLUMN last_modified_by INTEGER");
  }
  if (ticketCols.length > 0 && !ticketColNames.includes('project_id')) {
    db.exec("ALTER TABLE kanban_tickets ADD COLUMN project_id INTEGER REFERENCES kanban_projects(id)");
    try {
      db.exec("CREATE INDEX IF NOT EXISTS idx_tickets_project ON kanban_tickets(project_id)");
    } catch { /* index may already exist */ }
  }
  if (ticketCols.length > 0 && !ticketColNames.includes('position')) {
    db.exec("ALTER TABLE kanban_tickets ADD COLUMN position INTEGER DEFAULT 0");
  }

  const authCols = db.prepare("PRAGMA table_info(auth_users)").all() as { name: string }[];
  const authColNames = authCols.map(c => c.name);
  if (authCols.length > 0 && !authColNames.includes('is_admin')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN is_admin INTEGER DEFAULT 0");
  }
  if (authCols.length > 0 && !authColNames.includes('preferences')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN preferences TEXT DEFAULT '{}'");
  }
  if (authCols.length > 0 && !authColNames.includes('plan')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN plan TEXT DEFAULT 'free'");
  }
  if (authCols.length > 0 && !authColNames.includes('blocked')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN blocked INTEGER DEFAULT 0");
  }
  if (authCols.length > 0 && !authColNames.includes('blocked_reason')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN blocked_reason TEXT");
  }
  if (authCols.length > 0 && !authColNames.includes('token_invalidated_at')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN token_invalidated_at TEXT");
  }
  if (authCols.length > 0 && !authColNames.includes('stripe_customer_id')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN stripe_customer_id TEXT");
  }
  if (authCols.length > 0 && !authColNames.includes('stripe_subscription_id')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN stripe_subscription_id TEXT");
  }
  if (authCols.length > 0 && !authColNames.includes('stripe_subscription_status')) {
    db.exec("ALTER TABLE auth_users ADD COLUMN stripe_subscription_status TEXT");
  }

  if (ticketCols.length > 0 && !ticketColNames.includes('due_date')) {
    db.exec("ALTER TABLE kanban_tickets ADD COLUMN due_date TEXT");
  }

  const projectCols = db.prepare("PRAGMA table_info(kanban_projects)").all() as { name: string }[];
  const projectColNames = projectCols.map(c => c.name);
  if (projectCols.length > 0 && !projectColNames.includes('cursors_enabled')) {
    db.exec("ALTER TABLE kanban_projects ADD COLUMN cursors_enabled INTEGER DEFAULT 1");
  }
  if (projectCols.length > 0 && !projectColNames.includes('presence_enabled')) {
    db.exec("ALTER TABLE kanban_projects ADD COLUMN presence_enabled INTEGER DEFAULT 1");
  }
  if (projectCols.length > 0 && !projectColNames.includes('presence_max_visible')) {
    db.exec("ALTER TABLE kanban_projects ADD COLUMN presence_max_visible INTEGER DEFAULT 5");
  }
  if (projectCols.length > 0 && !projectColNames.includes('setup_completed')) {
    db.exec("ALTER TABLE kanban_projects ADD COLUMN setup_completed INTEGER DEFAULT 0");
  }

  // ── Repo multi-provider columns ──
  const repoCols = db.prepare("PRAGMA table_info(kanban_repos)").all() as { name: string }[];
  const repoColNames = repoCols.map(c => c.name);
  if (repoCols.length > 0 && !repoColNames.includes('git_provider')) {
    db.exec("ALTER TABLE kanban_repos ADD COLUMN git_provider TEXT DEFAULT 'bitbucket'");
  }
  if (repoCols.length > 0 && !repoColNames.includes('provider_owner')) {
    db.exec("ALTER TABLE kanban_repos ADD COLUMN provider_owner TEXT DEFAULT ''");
  }
  if (repoCols.length > 0 && !repoColNames.includes('provider_repo')) {
    db.exec("ALTER TABLE kanban_repos ADD COLUMN provider_repo TEXT DEFAULT ''");
  }
  if (repoCols.length > 0 && !repoColNames.includes('provider_token')) {
    db.exec("ALTER TABLE kanban_repos ADD COLUMN provider_token TEXT DEFAULT ''");
  }
  if (repoCols.length > 0 && !repoColNames.includes('clone_url')) {
    db.exec("ALTER TABLE kanban_repos ADD COLUMN clone_url TEXT DEFAULT ''");
  }

  // Encrypt existing repo credentials at rest (idempotent)
  try {
    const repos = db.prepare('SELECT id, provider_token, clone_url FROM kanban_repos').all() as { id: string; provider_token: string; clone_url: string }[];
    const upd = db.prepare('UPDATE kanban_repos SET provider_token = ?, clone_url = ? WHERE id = ?');
    for (const r of repos) {
      const nextProviderToken = r.provider_token && !isEncryptedSecret(r.provider_token) ? encryptSecret(r.provider_token) : r.provider_token;
      const nextCloneUrl = r.clone_url && !isEncryptedSecret(r.clone_url) ? encryptSecret(r.clone_url) : r.clone_url;
      if (nextProviderToken !== r.provider_token || nextCloneUrl !== r.clone_url) {
        upd.run(nextProviderToken, nextCloneUrl, r.id);
      }
    }
  } catch {
    // best effort only
  }

  // ── Deploy configs table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_deploy_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL UNIQUE REFERENCES kanban_projects(id) ON DELETE CASCADE,
      cf_project_name TEXT,
      cf_site_url TEXT,
      cf_api_token TEXT,
      cf_account_id TEXT,
      supabase_tenant_id TEXT,
      custom_domain TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Encrypt existing deploy credentials at rest (idempotent)
  try {
    const deployRows = db.prepare('SELECT id, cf_api_token FROM kanban_deploy_configs').all() as { id: number; cf_api_token: string | null }[];
    const upd = db.prepare('UPDATE kanban_deploy_configs SET cf_api_token = ? WHERE id = ?');
    for (const row of deployRows) {
      if (!row.cf_api_token) continue;
      if (isEncryptedSecret(row.cf_api_token)) continue;
      upd.run(encryptSecret(row.cf_api_token), row.id);
    }
  } catch {
    // best effort only
  }

  // Hash existing auth codes at rest (idempotent)
  try {
    const authRows = db.prepare('SELECT id, code FROM auth_codes').all() as { id: number; code: string }[];
    const upd = db.prepare('UPDATE auth_codes SET code = ? WHERE id = ?');
    for (const row of authRows) {
      if (!row.code || isHashedAuthCode(row.code)) continue;
      upd.run(hashAuthCode(row.code), row.id);
    }
  } catch {
    // best effort only
  }

  // ── Seed data ──

  // Default system prompt
  const existing = db.prepare('SELECT config_key FROM kanban_config WHERE config_key = ?').get('system_prompt');
  if (!existing) {
    db.prepare('INSERT INTO kanban_config (config_key, config_value) VALUES (?, ?)').run(
      'system_prompt',
      'You are an expert developer. You write clean, secure, well-structured code. You follow existing code conventions and patterns. Always respond with valid JSON containing the modified files.'
    );
  }

  // Default repo
  const existingRepo = db.prepare('SELECT id FROM kanban_repos WHERE id = ?').get('main-site');
  if (!existingRepo) {
    db.prepare('INSERT INTO kanban_repos (id, label, bitbucket_workspace, bitbucket_repo_slug) VALUES (?, ?, ?, ?)').run(
      'main-site', 'Main Site', '', ''
    );
  }

  // Seed admin user from ADMIN_EMAIL env var
  if (config.adminEmail) {
    const adminUser = db.prepare('SELECT id FROM auth_users WHERE email = ?').get(config.adminEmail);
    if (adminUser) {
      db.prepare('UPDATE auth_users SET is_admin = 1 WHERE email = ?').run(config.adminEmail);
    }
  }

  // ── Migrate existing tickets to default projects ──
  const migrationDone = db.prepare("SELECT config_value FROM kanban_config WHERE config_key = 'projects_migration_done'").get() as { config_value: string } | undefined;
  if (!migrationDone) {
    const usersWithTickets = db.prepare("SELECT DISTINCT user_id FROM kanban_tickets WHERE user_id IS NOT NULL AND project_id IS NULL").all() as { user_id: number }[];
    const migrateStmt = db.transaction(() => {
      for (const { user_id } of usersWithTickets) {
        // Create default project
        const result = db.prepare(
          "INSERT INTO kanban_projects (name, description, slug, owner_id, is_private, default_repo) VALUES (?, ?, ?, ?, 1, 'main-site')"
        ).run('Mon Projet', 'Projet par défaut', 'mon-projet', user_id);
        const projectId = result.lastInsertRowid;
        // Insert user as owner member
        db.prepare(
          "INSERT OR IGNORE INTO kanban_project_members (project_id, user_id, role) VALUES (?, ?, 'owner')"
        ).run(projectId, user_id);
        // Assign all their tickets to this project
        db.prepare(
          "UPDATE kanban_tickets SET project_id = ? WHERE user_id = ? AND project_id IS NULL"
        ).run(projectId, user_id);
      }
      db.prepare(
        "INSERT INTO kanban_config (config_key, config_value) VALUES ('projects_migration_done', '1')"
      ).run();
    });
    migrateStmt();
    if (usersWithTickets.length > 0) {
      console.log(`[DB] Migrated ${usersWithTickets.length} user(s) to default projects`);
    }
  }

  console.log('[DB] Migrations completed');
}

export { migrate };
