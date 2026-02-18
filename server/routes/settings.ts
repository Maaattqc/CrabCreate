import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { updateSettingsSchema } from '../schemas';
import { requireAdmin } from '../middleware/auth';
import { createRateLimitStore } from '../middleware/rate-limit-store';

const router = Router();

const settingsWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  store: createRateLimitStore('settings_write'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many settings changes. Try again later.' },
});

// All settings routes are admin-only
router.use(requireAdmin);

const NUMERIC_KEYS = [
  'max_requests_per_minute',
  'max_tickets_per_hour',
  'max_concurrent_pipelines',
  'ai_review_threshold',
  'ai_max_tokens',
  'session_duration_days',
  'log_retention_days',
  'plan_free_tickets',
  'plan_free_pipelines',
  'plan_pro_tickets',
  'plan_pro_pipelines',
  'plan_enterprise_tickets',
  'plan_enterprise_pipelines',
  // AI tokens per task
  'ai_tokens_complexity',
  'ai_tokens_chat',
  'ai_tokens_review',
  // Auth rate limits
  'auth_code_expiry_minutes',
  'auth_code_limit',
  'auth_code_window_minutes',
  'auth_verify_limit',
  'auth_verify_window_minutes',
  'contact_limit',
  'contact_window_minutes',
  'chat_messages_per_minute',
  'export_requests_per_hour',
  'max_user_webhooks_per_project',
  // Git & Deploy
  'branch_name_max_length',
  // Queue & Pipeline
  'queue_polling_interval_ms',
  'test_multiplier_per_file',
  // Interface
  'audit_log_default_limit',
  'audit_log_max_limit',
  'notification_timeout_ms',
  'score_threshold_good',
  'score_threshold_ok',
  'activity_preview_length',
] as const;

const BOOLEAN_KEYS = [
  'dev_login_enabled',
  'registration_enabled',
  'auto_test_enabled',
  'auto_deploy_enabled',
  'maintenance_mode',
  'git_pr_close_source_branch',
  'auto_repo_enabled',
  'auto_repo_default_private',
] as const;

const STRING_KEYS = [
  'default_ai_model',
  'ai_model_claude_version',
  'ai_model_gpt_version',
  'git_default_branch',
  'git_target_branch',
  'git_merge_strategy',
] as const;

const FLOAT_KEYS = [
  'ai_cost_per_token_claude',
  'ai_cost_per_token_gpt',
] as const;

const ALL_KEYS = [...NUMERIC_KEYS, ...BOOLEAN_KEYS, ...STRING_KEYS, ...FLOAT_KEYS];

const DEFAULTS: Record<string, number | string> = {
  max_requests_per_minute: 60,
  max_tickets_per_hour: 20,
  max_concurrent_pipelines: 2,
  default_ai_model: 'claude',
  ai_review_threshold: 50,
  ai_max_tokens: 8192,
  dev_login_enabled: 1,
  registration_enabled: 1,
  session_duration_days: 30,
  auto_test_enabled: 1,
  auto_deploy_enabled: 1,
  maintenance_mode: 0,
  auto_repo_enabled: 1,
  auto_repo_default_private: 1,
  log_retention_days: 90,
  plan_free_tickets: 5,
  plan_free_pipelines: 1,
  plan_pro_tickets: 50,
  plan_pro_pipelines: 3,
  plan_enterprise_tickets: -1,
  plan_enterprise_pipelines: 10,
  // Modèles & Coûts
  ai_model_claude_version: 'claude-opus-4-6',
  ai_model_gpt_version: 'gpt-5.2-2025-12-11',
  ai_cost_per_token_claude: 0.000015,
  ai_cost_per_token_gpt: 0.00003,
  ai_tokens_complexity: 500,
  ai_tokens_chat: 4096,
  ai_tokens_review: 2048,
  // Auth rate limits
  auth_code_expiry_minutes: 10,
  auth_code_limit: 5,
  auth_code_window_minutes: 15,
  auth_verify_limit: 10,
  auth_verify_window_minutes: 15,
  contact_limit: 3,
  contact_window_minutes: 60,
  chat_messages_per_minute: 20,
  export_requests_per_hour: 30,
  max_user_webhooks_per_project: 20,
  // Git & Deploy
  git_default_branch: 'master',
  git_target_branch: 'develop',
  git_merge_strategy: 'merge_commit',
  git_pr_close_source_branch: 1,
  branch_name_max_length: 30,
  // Queue & Pipeline
  queue_polling_interval_ms: 5000,
  test_multiplier_per_file: 3,
  // Interface
  audit_log_default_limit: 50,
  audit_log_max_limit: 200,
  notification_timeout_ms: 5000,
  score_threshold_good: 70,
  score_threshold_ok: 50,
  activity_preview_length: 50,
};

const NUMERIC_BOUNDS: Record<string, { min: number; max: number }> = {
  max_requests_per_minute: { min: 1, max: 1000 },
  max_tickets_per_hour: { min: 1, max: 100 },
  max_concurrent_pipelines: { min: 1, max: 10 },
  ai_review_threshold: { min: 0, max: 100 },
  ai_max_tokens: { min: 1024, max: 32000 },
  session_duration_days: { min: 1, max: 365 },
  log_retention_days: { min: 7, max: 365 },
  plan_free_tickets: { min: 1, max: 1000 },
  plan_free_pipelines: { min: 1, max: 50 },
  plan_pro_tickets: { min: 1, max: 1000 },
  plan_pro_pipelines: { min: 1, max: 50 },
  plan_enterprise_tickets: { min: -1, max: 1000 },
  plan_enterprise_pipelines: { min: 1, max: 50 },
  ai_tokens_complexity: { min: 200, max: 2000 },
  ai_tokens_chat: { min: 2048, max: 16384 },
  ai_tokens_review: { min: 1024, max: 8192 },
  auth_code_expiry_minutes: { min: 5, max: 60 },
  auth_code_limit: { min: 3, max: 20 },
  auth_code_window_minutes: { min: 5, max: 60 },
  auth_verify_limit: { min: 3, max: 30 },
  auth_verify_window_minutes: { min: 5, max: 60 },
  contact_limit: { min: 1, max: 10 },
  contact_window_minutes: { min: 15, max: 1440 },
  chat_messages_per_minute: { min: 1, max: 120 },
  export_requests_per_hour: { min: 1, max: 200 },
  max_user_webhooks_per_project: { min: 1, max: 100 },
  branch_name_max_length: { min: 15, max: 100 },
  queue_polling_interval_ms: { min: 1000, max: 30000 },
  test_multiplier_per_file: { min: 1, max: 10 },
  audit_log_default_limit: { min: 10, max: 100 },
  audit_log_max_limit: { min: 100, max: 1000 },
  notification_timeout_ms: { min: 2000, max: 15000 },
  score_threshold_good: { min: 50, max: 100 },
  score_threshold_ok: { min: 20, max: 80 },
  activity_preview_length: { min: 20, max: 200 },
  // Floats
  ai_cost_per_token_claude: { min: 0, max: 1 },
  ai_cost_per_token_gpt: { min: 0, max: 1 },
  // Booleans clamped 0-1
  dev_login_enabled: { min: 0, max: 1 },
  registration_enabled: { min: 0, max: 1 },
  auto_test_enabled: { min: 0, max: 1 },
  auto_deploy_enabled: { min: 0, max: 1 },
  maintenance_mode: { min: 0, max: 1 },
  git_pr_close_source_branch: { min: 0, max: 1 },
  auto_repo_enabled: { min: 0, max: 1 },
  auto_repo_default_private: { min: 0, max: 1 },
};

function readAllSettings(): Record<string, number | string> {
  const settings: Record<string, number | string> = {};
  for (const key of NUMERIC_KEYS) {
    const val = repo.getConfig(key);
    settings[key] = val !== undefined ? parseInt(val, 10) : DEFAULTS[key];
  }
  for (const key of BOOLEAN_KEYS) {
    const val = repo.getConfig(key);
    settings[key] = val !== undefined ? parseInt(val, 10) : DEFAULTS[key];
  }
  for (const key of STRING_KEYS) {
    const val = repo.getConfig(key);
    settings[key] = val !== undefined ? val : DEFAULTS[key];
  }
  for (const key of FLOAT_KEYS) {
    const val = repo.getConfig(key);
    settings[key] = val !== undefined ? parseFloat(val) : DEFAULTS[key];
  }
  return settings;
}

// GET /api/settings
router.get('/', (req: Request, res: Response) => {
  res.json(readAllSettings());
});

// PUT /api/settings
router.put('/', settingsWriteLimiter, validate(updateSettingsSchema), (req: Request, res: Response) => {
  const updates = req.body;
  const changedKeys: string[] = [];

  for (const key of ALL_KEYS) {
    if (updates[key] === undefined) continue;

    if ((STRING_KEYS as readonly string[]).includes(key)) {
      repo.setConfig(key, String(updates[key]));
    } else if ((FLOAT_KEYS as readonly string[]).includes(key)) {
      const bounds = NUMERIC_BOUNDS[key];
      const val = Math.max(bounds.min, Math.min(bounds.max, parseFloat(updates[key])));
      repo.setConfig(key, String(val));
    } else {
      const bounds = NUMERIC_BOUNDS[key];
      const val = Math.max(bounds.min, Math.min(bounds.max, parseInt(updates[key], 10)));
      repo.setConfig(key, String(val));
    }
    changedKeys.push(key);
  }

  // Audit trail for admin settings changes
  if (changedKeys.length > 0) {
    repo.insertAuditLog(req.user!.userId, req.user!.email, 'settings_update', 'admin', 0, JSON.stringify(changedKeys));
  }

  res.json(readAllSettings());
});

export default router;
