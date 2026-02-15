import { z } from 'zod';

export const createTicketSchema = z.object({
  title: z.string().min(3, 'Titre trop court (min 3 caractères)').max(200, 'Titre trop long (max 200)'),
  description: z.string().max(5000, 'Description trop longue').optional().default(''),
  ai_model: z.enum(['claude', 'gpt']).optional().default('claude'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  template: z.string().max(100).optional().default('feature'),
  repo: z.string().min(1).max(120).optional().default('main-site'),
  assignee: z.string().max(120).optional().default('unassigned'),
  target_files: z.array(z.string().min(1).max(260)).max(200).optional().default([]),
  tags: z.array(z.string().min(1).max(50)).max(50).optional().default([]),
  depends_on: z.array(z.number().int().positive()).max(100).optional().default([]),
  due_date: z.string().max(40).optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'estimating', 'ai_coding', 'ai_review', 'review', 'testing', 'deploying', 'done', 'cancelled']).optional(),
  template: z.string().max(100).optional(),
  ai_model: z.enum(['claude', 'gpt']).optional(),
  repo: z.string().min(1).max(120).optional(),
  assignee: z.string().max(120).optional(),
  target_files: z.union([z.string().max(50000), z.array(z.string().min(1).max(260)).max(200)]).optional(),
  tags: z.union([z.string().max(5000), z.array(z.string().min(1).max(50)).max(50)]).optional(),
  depends_on: z.union([z.string().max(5000), z.array(z.number().int().positive()).max(100)]).optional(),
  due_date: z.string().max(40).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const sendChatSchema = z.object({
  message: z.string().min(1, 'Message requis').max(10000, 'Message trop long'),
});

export const updatePromptsSchema = z.object({
  systemPrompt: z.string().min(0).max(50000),
});

export const updateSettingsSchema = z.object({
  // Rate limiting
  max_requests_per_minute: z.number().int().min(1).max(1000).optional(),
  max_tickets_per_hour: z.number().int().min(1).max(100).optional(),
  max_concurrent_pipelines: z.number().int().min(1).max(10).optional(),
  // IA
  default_ai_model: z.enum(['claude', 'gpt']).optional(),
  ai_review_threshold: z.number().int().min(0).max(100).optional(),
  ai_max_tokens: z.number().int().min(1024).max(32000).optional(),
  // Sécurité
  dev_login_enabled: z.number().int().min(0).max(1).optional(),
  registration_enabled: z.number().int().min(0).max(1).optional(),
  session_duration_days: z.number().int().min(1).max(365).optional(),
  // Pipeline
  auto_test_enabled: z.number().int().min(0).max(1).optional(),
  auto_deploy_enabled: z.number().int().min(0).max(1).optional(),
  // Maintenance
  maintenance_mode: z.number().int().min(0).max(1).optional(),
  log_retention_days: z.number().int().min(7).max(365).optional(),
  // Plans
  plan_free_tickets: z.number().int().min(1).max(1000).optional(),
  plan_free_pipelines: z.number().int().min(1).max(50).optional(),
  plan_pro_tickets: z.number().int().min(1).max(1000).optional(),
  plan_pro_pipelines: z.number().int().min(1).max(50).optional(),
  plan_enterprise_tickets: z.number().int().min(-1).max(1000).optional(),
  plan_enterprise_pipelines: z.number().int().min(1).max(50).optional(),
  plan_free_projects: z.number().int().min(1).max(100).optional(),
  plan_pro_projects: z.number().int().min(1).max(100).optional(),
  plan_enterprise_projects: z.number().int().min(-1).max(100).optional(),
  plan_free_members: z.number().int().min(1).max(100).optional(),
  plan_pro_members: z.number().int().min(1).max(100).optional(),
  plan_enterprise_members: z.number().int().min(-1).max(100).optional(),
  // Modèles & Coûts IA
  ai_model_claude_version: z.string().min(1).max(100).optional(),
  ai_model_gpt_version: z.string().min(1).max(100).optional(),
  ai_cost_per_token_claude: z.number().min(0).max(1).optional(),
  ai_cost_per_token_gpt: z.number().min(0).max(1).optional(),
  ai_tokens_complexity: z.number().int().min(200).max(2000).optional(),
  ai_tokens_chat: z.number().int().min(2048).max(16384).optional(),
  ai_tokens_review: z.number().int().min(1024).max(8192).optional(),
  // Auth rate limits
  auth_code_expiry_minutes: z.number().int().min(5).max(60).optional(),
  auth_code_limit: z.number().int().min(3).max(20).optional(),
  auth_code_window_minutes: z.number().int().min(5).max(60).optional(),
  auth_verify_limit: z.number().int().min(3).max(30).optional(),
  auth_verify_window_minutes: z.number().int().min(5).max(60).optional(),
  contact_limit: z.number().int().min(1).max(10).optional(),
  contact_window_minutes: z.number().int().min(15).max(1440).optional(),
  chat_messages_per_minute: z.number().int().min(1).max(120).optional(),
  export_requests_per_hour: z.number().int().min(1).max(200).optional(),
  max_user_webhooks_per_project: z.number().int().min(1).max(100).optional(),
  // Git & Deploy
  git_default_branch: z.string().min(1).max(100).optional(),
  git_merge_strategy: z.enum(['merge_commit', 'squash', 'fast_forward']).optional(),
  git_pr_close_source_branch: z.number().int().min(0).max(1).optional(),
  branch_name_max_length: z.number().int().min(15).max(100).optional(),
  // Queue & Pipeline
  queue_polling_interval_ms: z.number().int().min(1000).max(30000).optional(),
  test_multiplier_per_file: z.number().int().min(1).max(10).optional(),
  // Interface
  audit_log_default_limit: z.number().int().min(10).max(100).optional(),
  audit_log_max_limit: z.number().int().min(100).max(1000).optional(),
  notification_timeout_ms: z.number().int().min(2000).max(15000).optional(),
  score_threshold_good: z.number().int().min(50).max(100).optional(),
  score_threshold_ok: z.number().int().min(20).max(80).optional(),
  activity_preview_length: z.number().int().min(20).max(200).optional(),
});

// ── Admin ──────────────────────────────────────────────────────────────────

export const adminBlockSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const adminPlanSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
});

export const adminToggleSchema = z.object({
  isAdmin: z.boolean(),
});

// ── Auth preferences ───────────────────────────────────────────────────────

export const preferencesSchema = z.object({
  lang: z.enum(['fr', 'en']).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  animations: z.boolean().optional(),
  aiDesign: z.boolean().optional(),
  mascot: z.boolean().optional(),
});

export const requestCodeSchema = z.object({
  email: z.string().email('Email invalide').max(255).transform(v => v.trim().toLowerCase()),
});

export const verifyCodeSchema = z.object({
  email: z.string().email('Email invalide').max(255).transform(v => v.trim().toLowerCase()),
  code: z.string().length(6, 'Le code doit contenir 6 chiffres').regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
});

// ── Projects ─────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Nom trop court (min 2)').max(100, 'Nom trop long (max 100)'),
  description: z.string().max(500, 'Description trop longue').optional().default(''),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (minuscules, chiffres, tirets)'),
  is_private: z.number().int().min(0).max(1).optional().default(1),
  default_repo: z.string().optional().default('main-site'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  is_private: z.number().int().min(0).max(1).optional(),
  default_repo: z.string().optional(),
  cursors_enabled: z.number().int().min(0).max(1).optional(),
  presence_enabled: z.number().int().min(0).max(1).optional(),
  presence_max_visible: z.number().int().min(1).max(20).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

export const inviteMemberSchema = z.object({
  email: z.string().email('Email invalide').max(255),
  role: z.enum(['admin', 'member', 'viewer']).optional().default('member'),
});

export const changeMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export const transferOwnershipSchema = z.object({
  new_owner_id: z.number().int().positive(),
});

export const reorderTicketsSchema = z.object({
  ticketIds: z.array(z.number().int().positive()).min(1).max(500),
});

// ── Collaboration ────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Contenu requis').max(5000, 'Contenu trop long'),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Contenu requis').max(5000, 'Contenu trop long'),
});

export const toggleReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

// ── Subtasks ────────────────────────────────────────────────────────────────

export const createSubtaskSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(200, 'Titre trop long (max 200)'),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.number().int().min(0).max(1).optional(),
  position: z.number().int().min(0).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

// ── Labels ──────────────────────────────────────────────────────────────────

export const createLabelSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50, 'Nom trop long (max 50)'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale invalide'),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

// ── Ticket Templates ────────────────────────────────────────────────────────

export const createTicketTemplateSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100, 'Nom trop long (max 100)'),
  title_template: z.string().max(200).optional().default(''),
  description_template: z.string().max(5000).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  template: z.string().optional().default('feature'),
  tags: z.array(z.string()).optional().default([]),
});

export const updateTicketTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  title_template: z.string().max(200).optional(),
  description_template: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  template: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

// ── User Webhooks ───────────────────────────────────────────────────────────

const WEBHOOK_EVENT_SCHEMA = z.enum([
  'ticket:created',
  'ticket:updated',
  'ticket:deleted',
  'ticket:status_changed',
  'pipeline:completed',
  'comment:added',
]);

export const createUserWebhookSchema = z.object({
  url: z.string().url('URL invalide').max(500, 'URL trop longue').refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL webhook doit utiliser HTTPS'),
  events: z.array(WEBHOOK_EVENT_SCHEMA).min(1, 'Au moins un evenement requis').max(10),
  secret: z.string().max(200).optional(),
});

export const updateUserWebhookSchema = z.object({
  url: z.string().url().max(500).refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL webhook doit utiliser HTTPS').optional(),
  events: z.array(WEBHOOK_EVENT_SCHEMA).max(10).optional(),
  enabled: z.number().int().min(0).max(1).optional(),
  secret: z.string().max(200).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

// ── Project Setup ───────────────────────────────────────────────────────────

export const connectRepoSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']),
  owner: z.string().min(1, 'Owner requis').max(100),
  repo: z.string().min(1, 'Repo requis').max(100),
  token: z.string().min(1, 'Token requis').max(500),
  branch: z.string().min(1).max(100).optional().default('main'),
});

export const createRepoSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']),
  token: z.string().min(1, 'Token requis').max(500),
  repoName: z.string().min(1, 'Nom du repo requis').max(100),
  isPrivate: z.boolean().optional().default(true),
});

export const configureDeploySchema = z.object({
  cfApiToken: z.string().min(1, 'Cloudflare API Token requis').max(500),
  cfAccountId: z.string().min(1, 'Account ID requis').max(100),
});

