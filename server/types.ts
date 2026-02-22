import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface Ticket {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  template: string;
  ai_model: string;
  repo: string;
  assignee: string;
  complexity: string;
  target_files: string | null;
  tags: string | null;
  depends_on: string | null;
  branch_name: string | null;
  due_date: string | null;
  archived_at: string | null;
  pr_url: string | null;
  pr_id: number | null;
  staging_url: string | null;
  lines_added: number;
  lines_removed: number;
  tokens_used: number;
  cost_usd: number;
  ai_review_score: number | null;
  ai_review_data: string | null;
  test_results: string | null;
  progress: number;
  pipeline_step: number;
  pipeline_started_at: string | null;
  position: number;
  column_position: number;
  user_id: number | null;
  project_id: number | null;
  last_modified_by: number | null;
  creator_email: string | null;
  modifier_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: number;
  ticket_id: number;
  message: string;
  log_type: string;
  phase: string;
  created_at: string;
}

export interface Repo {
  id: string;
  label: string;
  bitbucket_workspace: string;
  bitbucket_repo_slug: string;
  default_branch: string;
  target_branch: string;
  local_path: string;
  git_provider: 'github' | 'gitlab' | 'bitbucket';
  provider_owner: string;
  provider_repo: string;
  provider_token: string;
  clone_url: string;
  created_at: string;
  [key: string]: unknown;
}

export interface ConfigRow {
  config_key: string;
  config_value: string;
  updated_at?: string;
}

export interface ChatMessage {
  id?: number;
  ticket_id?: number;
  role: 'user' | 'ai' | string;
  message: string;
  created_at?: string;
}

export interface ActivityEntry {
  id: number;
  ticket_id: number;
  message: string;
  activity_type: string;
  created_at: string;
}

export interface ActivityWithTitle extends ActivityEntry {
  ticket_title: string;
}

export interface FileLock {
  id?: number;
  file_path: string;
  ticket_id: number;
  locked_at?: string;
  ticket_title?: string;
}

export interface CountResult {
  count: number;
}

export interface SumResult {
  total: number;
}

export interface AvgResult {
  avg: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface RepoCount {
  repo: string;
  count: number;
}

export interface ModelCount {
  ai_model: string;
  count: number;
}

export interface TemplateCount {
  template: string;
  count: number;
}

export interface AnalyticsResult {
  total: number;
  byStatus: StatusCount[];
  byPriority: PriorityCount[];
  byRepo: RepoCount[];
  byModel: ModelCount[];
  byTemplate: TemplateCount[];
  tokensTotal: number;
  costTotal: number;
  linesAdded: number;
  linesRemoved: number;
  avgScore: number;
  approvalRate: number;
  approved: number;
  rejected: number;
  fileLocks: number;
  recentActivity: ActivityWithTitle[];
  topFiles: { file: string; count: number }[];
}

export interface CodeFile {
  path: string;
  content: string;
}

export interface CodingResult {
  files: CodeFile[];
  baseFiles: CodeFile[];
  summary: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  tokensUsed: number;
  costUsd: number;
  branchName: string;
  repoDir: string;
  previewPath: string;
  modificationPrompt?: string;
}

export interface ReviewIssue {
  severity: 'warning' | 'info' | 'error';
  message: string;
  file: string | null;
  line: number | null;
}

export interface ReviewResult {
  score: number;
  summary: string;
  issues: ReviewIssue[];
}

export interface DependencyCheckResult {
  ok: boolean;
  message?: string;
}

export interface DeployResult {
  prUrl: string;
  prId: number;
  stagingUrl: string;
}

export interface FileCheckResult {
  ok: boolean;
  message?: string;
}

export interface TestCase {
  name: string;
  file: string;
  status: 'passed' | 'failed';
  message: string | null;
  duration: number;
}

export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  tests: TestCase[];
}

export type AIClient =
  | { type: 'openai'; client: OpenAI }
  | { type: 'anthropic'; client: Anthropic };

export interface UserPreferences {
  lang?: 'fr' | 'en';
  theme?: 'dark' | 'light';
  animations?: boolean;
  aiDesign?: boolean;
  mascot?: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  is_admin: number;
  plan: string;
  blocked: number;
  blocked_reason: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  preferences: string;
  created_at: string;
  last_login_at: string | null;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  ip: string | null;
  created_at: string;
}

export interface AuthCode {
  id: number;
  email: string;
  code: string;
  expires_at: string;
  used: number;
  attempts: number;
  created_at: string;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Project {
  id: number;
  name: string;
  description: string;
  slug: string;
  owner_id: number;
  is_private: number;
  default_repo: string;
  setup_completed: number;
  cursors_enabled: number;
  presence_enabled: number;
  presence_max_visible: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: ProjectRole;
  joined_at: string;
}

export interface ProjectMemberWithEmail extends ProjectMember {
  email: string;
}

export interface ProjectWithRole extends Project {
  role: ProjectRole;
}

export interface ProjectInvitation {
  id: number;
  project_id: number;
  email: string;
  role: ProjectRole;
  invited_by: number;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface ProjectInvitationWithProject extends ProjectInvitation {
  project_name: string;
  inviter_email: string;
}

// ── Collaboration ────────────────────────────────────────────────────────────

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CommentWithUser extends Comment {
  email: string;
}

export interface Reaction {
  id: number;
  comment_id: number;
  user_id: number;
  emoji: string;
  created_at: string;
}

export interface ReactionWithUser extends Reaction {
  email: string;
}

export interface Watcher {
  id: number;
  ticket_id: number;
  user_id: number;
  created_at: string;
}

export interface WatcherWithEmail extends Watcher {
  email: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  ticket_id: number | null;
  project_id: number | null;
  read: number;
  created_at: string;
}

// ── Labels ──────────────────────────────────────────────────────────────────

export interface Label {
  id: number;
  project_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface TicketLabel {
  ticket_id: number;
  label_id: number;
}

// ── Subtasks ────────────────────────────────────────────────────────────────

export interface Subtask {
  id: number;
  ticket_id: number;
  title: string;
  description: string;
  completed: number;
  position: number;
  ai_generated: number;
  created_at: string;
}

// ── Favorites ───────────────────────────────────────────────────────────────

export interface Favorite {
  user_id: number;
  ticket_id: number;
  created_at: string;
}

export interface FavoriteWithTicket extends Favorite {
  title: string;
  status: string;
  priority: string;
}

// ── Ticket Templates ────────────────────────────────────────────────────────

export interface TicketTemplate {
  id: number;
  project_id: number;
  name: string;
  title_template: string;
  description_template: string;
  priority: string;
  template: string;
  tags: string;
  created_at: string;
}

// ── User Webhooks ───────────────────────────────────────────────────────────

export interface UserWebhook {
  id: number;
  project_id: number;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
  created_at: string;
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'ticket' | 'comment' | 'activity';
  id: number;
  ticket_id: number;
  title: string;
  snippet: string;
  created_at: string;
}

// ── Deploy Configs ─────────────────────────────────────────────────────────

export interface DeployConfig {
  id: number;
  project_id: number;
  cf_project_name: string | null;
  cf_site_url: string | null;
  cf_api_token: string | null;
  cf_account_id: string | null;
  supabase_tenant_id: string | null;
  custom_domain: string | null;
  production_manifest: string | null;
  created_at: string;
}

export interface ProjectSetupStatus {
  repoConfigured: boolean;
  deployConfigured: boolean;
  gitProvider: string | null;
  repoUrl: string | null;
  cfSiteUrl: string | null;
}
