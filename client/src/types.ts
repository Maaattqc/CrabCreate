export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  template: string;
  ai_model: string;
  repo: string;
  assignee: string;
  progress: number;
  cost_usd: number;
  tokens_used: number;
  lines_added: number;
  lines_removed: number;
  ai_review_score: number | null;
  ai_review_data: string | null;
  test_results: string | null;
  target_files: string;
  tags: string;
  depends_on: string;
  complexity: string;
  pipeline_step: number;
  position: number;
  due_date: string | null;
  branch_name: string;
  pr_url: string;
  pr_id: number;
  staging_url: string;
  diff: string;
  creator_email: string | null;
  modifier_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  label: string;
  color: string;
}

export interface Priority {
  id: string;
  label: string;
  color: string;
}

export interface Template {
  id: string;
  label: string;
  icon: string;
}

export interface AIModel {
  id: string;
  label: string;
}

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

export interface LogEntry {
  id: number;
  message: string;
  log_type: string;
  phase: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  message: string;
  created_at: string;
}

export interface ActivityItem {
  id: number;
  ticket_id: number;
  activity_type: string;
  message: string;
  created_at: string;
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
}

export interface ReviewData {
  score: number;
  summary: string;
  issues: ReviewIssue[];
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
}

export interface TestResults {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  tests: TestResult[];
}

export interface FileLock {
  file_path: string;
  ticket_id: number;
}

export interface AnalyticsData {
  total: number;
  tokensTotal: number;
  costTotal: number;
  linesAdded: number;
  linesRemoved: number;
  avgScore: number;
  approvalRate: number;
  fileLocks: number;
  byStatus: { status: string; count: number }[];
  byModel: { ai_model: string; count: number }[];
  topFiles: { file: string; count: number }[];
  recentActivity: { id: number; ticket_id: number; message: string }[];
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  template?: string;
  [key: string]: string | undefined;
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
  cf_site_url: string | null;
  role: ProjectRole;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  email: string;
  role: ProjectRole;
  joined_at: string;
}

export interface ProjectInvitation {
  id: number;
  project_id: number;
  email: string;
  role: ProjectRole;
  token: string;
  status: string;
  project_name: string;
  inviter_email: string;
  expires_at: string;
  created_at: string;
}

// ── Live Cursors & Presence ─────────────────────────────────────────────────

export interface CursorData {
  userId: number;
  email: string;
  x: number;
  y: number;
}

export interface RemoteCursor extends CursorData {
  color: string;
  lastSeen: number;
}

export interface PresenceUser {
  userId: number;
  email: string;
  color: string;
}

// ── Collaboration ─────────────────────────────────────────────────────────

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  email: string;
  content: string;
  reactions: ReactionGroup[];
  created_at: string;
  updated_at: string;
}

export interface ReactionGroup {
  id: number;
  comment_id: number;
  user_id: number;
  email: string;
  emoji: string;
  created_at: string;
}

export interface WatcherInfo {
  watchers: { user_id: number; email: string }[];
  isWatching: boolean;
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

export interface TicketViewer {
  userId: number;
  email: string;
}

export interface UserStatus {
  userId: number;
  email: string;
  status: 'available' | 'busy' | 'away';
}

// ── Labels ──────────────────────────────────────────────────────────────────

export interface Label {
  id: number;
  project_id: number;
  name: string;
  color: string;
  created_at: string;
}

// ── Subtasks ────────────────────────────────────────────────────────────────

export interface Subtask {
  id: number;
  ticket_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

// ── Favorites ───────────────────────────────────────────────────────────────

export interface FavoriteTicket {
  user_id: number;
  ticket_id: number;
  title: string;
  status: string;
  priority: string;
  created_at: string;
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
  events: string | string[];
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

// ── Project Setup ────────────────────────────────────────────────────────

export interface ProjectSetupStatus {
  repoConfigured: boolean;
  deployConfigured: boolean;
  gitProvider: string | null;
  repoUrl: string | null;
  cfSiteUrl: string | null;
}

export type GitProviderType = 'github' | 'gitlab' | 'bitbucket';

export interface ConnectRepoPayload {
  provider: GitProviderType;
  owner: string;
  repo: string;
  token: string;
  branch: string;
}

export interface CreateRepoPayload {
  provider: GitProviderType;
  token: string;
  repoName: string;
  isPrivate: boolean;
}

export type ConfigureDeployPayload = Record<string, never>;

// ── Column Times ────────────────────────────────────────────────────────

export interface ColumnTime {
  status: string;
  duration_seconds: number;
}
