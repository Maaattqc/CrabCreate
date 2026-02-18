import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Mail, Settings, BarChart3, Shield, ShieldOff, Crown, Trash2,
  ArrowLeft, X, AlertTriangle, ScrollText, Loader2,
  Brain, Lock, Workflow, Wrench, CreditCard, Cpu, GitBranch, GitFork, Monitor,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';

interface AdminUser {
  id: number;
  email: string;
  isAdmin: boolean;
  plan: string;
  blocked: boolean;
  blockedReason: string | null;
  stripeSubscriptionStatus: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface ContactMsg {
  id: number;
  name: string;
  email: string;
  message: string;
  ip: string | null;
  created_at: string;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  planCounts: Record<string, number>;
  totalTickets: number;
  totalCost: number;
  totalTokens: number;
}

interface AdminSettings {
  // Rate limiting
  max_requests_per_minute: number;
  max_tickets_per_hour: number;
  max_concurrent_pipelines: number;
  // IA
  default_ai_model: string;
  ai_review_threshold: number;
  ai_max_tokens: number;
  // Security
  dev_login_enabled: number;
  registration_enabled: number;
  session_duration_days: number;
  // Pipeline
  auto_test_enabled: number;
  auto_deploy_enabled: number;
  // Maintenance
  maintenance_mode: number;
  log_retention_days: number;
  // Plans
  plan_free_tickets: number;
  plan_free_pipelines: number;
  plan_pro_tickets: number;
  plan_pro_pipelines: number;
  plan_enterprise_tickets: number;
  plan_enterprise_pipelines: number;
  plan_free_projects: number;
  plan_pro_projects: number;
  plan_enterprise_projects: number;
  plan_free_members: number;
  plan_pro_members: number;
  plan_enterprise_members: number;
  // Modèles & Coûts
  ai_model_claude_version: string;
  ai_model_gpt_version: string;
  ai_cost_per_token_claude: number;
  ai_cost_per_token_gpt: number;
  ai_tokens_complexity: number;
  ai_tokens_chat: number;
  ai_tokens_review: number;
  // Auth rate limits
  auth_code_expiry_minutes: number;
  auth_code_limit: number;
  auth_code_window_minutes: number;
  auth_verify_limit: number;
  auth_verify_window_minutes: number;
  contact_limit: number;
  contact_window_minutes: number;
  // Git & Deploy
  git_default_branch: string;
  git_target_branch: string;
  git_merge_strategy: string;
  git_pr_close_source_branch: number;
  branch_name_max_length: number;
  // Auto-repo
  auto_repo_enabled: number;
  auto_repo_default_private: number;
  // Queue & Pipeline
  queue_polling_interval_ms: number;
  test_multiplier_per_file: number;
  // Interface
  audit_log_default_limit: number;
  audit_log_max_limit: number;
  notification_timeout_ms: number;
  score_threshold_good: number;
  score_threshold_ok: number;
  activity_preview_length: number;
}

interface AuditLog {
  id: number;
  user_id: number | null;
  user_email: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
}

type Tab = 'stats' | 'users' | 'contacts' | 'logs' | 'settings';

const API = '/api/admin';
const SETTINGS_API = '/api/settings';

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [contacts, setContacts] = useState<ContactMsg[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, activeUsers: 0, blockedUsers: 0, planCounts: {}, totalTickets: 0, totalCost: 0, totalTokens: 0,
  });
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AdminSettings>({
    max_requests_per_minute: 60, max_tickets_per_hour: 10, max_concurrent_pipelines: 2,
    default_ai_model: 'claude', ai_review_threshold: 70, ai_max_tokens: 8000,
    dev_login_enabled: 0, registration_enabled: 1, session_duration_days: 7,
    auto_test_enabled: 1, auto_deploy_enabled: 0, maintenance_mode: 0, log_retention_days: 30,
    plan_free_tickets: 5, plan_free_pipelines: 1, plan_pro_tickets: 50, plan_pro_pipelines: 3,
    plan_enterprise_tickets: -1, plan_enterprise_pipelines: 10,
    plan_free_projects: 1, plan_pro_projects: 5, plan_enterprise_projects: -1,
    plan_free_members: 1, plan_pro_members: 5, plan_enterprise_members: -1,
    ai_model_claude_version: 'claude-sonnet-4-5-20250929', ai_model_gpt_version: 'gpt-4o',
    ai_cost_per_token_claude: 0.000003, ai_cost_per_token_gpt: 0.00001,
    ai_tokens_complexity: 500, ai_tokens_chat: 4096, ai_tokens_review: 2048,
    auth_code_expiry_minutes: 10, auth_code_limit: 5, auth_code_window_minutes: 15,
    auth_verify_limit: 5, auth_verify_window_minutes: 15, contact_limit: 3, contact_window_minutes: 60,
    git_default_branch: 'master', git_target_branch: 'develop', git_merge_strategy: 'merge_commit', git_pr_close_source_branch: 1,
    branch_name_max_length: 50, auto_repo_enabled: 0, auto_repo_default_private: 1,
    queue_polling_interval_ms: 5000, test_multiplier_per_file: 3,
    audit_log_default_limit: 50, audit_log_max_limit: 500, notification_timeout_ms: 5000,
    score_threshold_good: 70, score_threshold_ok: 50, activity_preview_length: 80,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsCategory, setLogsCategory] = useState<string>('all');
  const [blockModal, setBlockModal] = useState<{ userId: number; email: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  // Redirect non-admin
  useEffect(() => {
    if (user && !user.isAdmin) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const fetchLogs = useCallback(async (offset = 0, category = 'all') => {
    setLogsLoading(true);
    try {
      const catParam = category !== 'all' ? `&category=${category}` : '';
      const res = await fetch(`${API}/logs?limit=50&offset=${offset}${catParam}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setLogs(data.logs);
        } else {
          setLogs(prev => [...prev, ...data.logs]);
        }
        setLogsTotal(data.total);
      }
    } catch (err) {
      console.error('[Admin] logs fetch error', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, contactsRes, statsRes, settingsRes] = await Promise.all([
        fetch(`${API}/users`, { credentials: 'include' }),
        fetch(`${API}/contacts`, { credentials: 'include' }),
        fetch(`${API}/stats`, { credentials: 'include' }),
        fetch(SETTINGS_API, { credentials: 'include' }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings(s);
        setSettingsDraft(s);
      }
      fetchLogs(0, logsCategory);
    } catch (err) {
      console.error('[Admin] fetch error', err);
    } finally {
      setInitialLoading(false);
    }
  }, [fetchLogs, logsCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBlock = async (userId: number, block: boolean, reason?: string) => {
    await fetch(`${API}/users/${userId}/block`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ blocked: block, reason }),
    });
    setBlockModal(null);
    setBlockReason('');
    fetchData();
  };

  const handlePlanChange = async (userId: number, plan: string) => {
    await fetch(`${API}/users/${userId}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan }),
    });
    fetchData();
  };

  const handleAdminToggle = async (userId: number, isAdmin: boolean) => {
    await fetch(`${API}/users/${userId}/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isAdmin }),
    });
    fetchData();
  };

  const handleDeleteContact = async (id: number) => {
    await fetch(`${API}/contacts/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchData();
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) return;
    setSaving(true);
    await fetch(SETTINGS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settingsDraft),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
  };

  const tabs: { key: Tab; icon: typeof BarChart3; label: string }[] = [
    { key: 'stats', icon: BarChart3, label: t.adminStats },
    { key: 'users', icon: Users, label: t.adminUsers },
    { key: 'contacts', icon: Mail, label: t.adminContacts },
    { key: 'logs', icon: ScrollText, label: t.adminLogs },
    { key: 'settings', icon: Settings, label: t.adminSettings },
  ];

  const planColors: Record<string, string> = {
    free: 'text-tx-faint bg-subtle',
    pro: 'text-amber-400 bg-amber-500/10',
    enterprise: 'text-purple-400 bg-purple-500/10',
  };

  if (initialLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-tx-primary" style={{ background: 'var(--bg-gradient)' }}>
        <Loader2 size={32} className="text-amber-400 animate-spin mb-4" />
        <p className="text-sm text-tx-faint">{t.adminTitle}...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col text-tx-primary overflow-hidden" style={{ background: 'var(--bg-gradient)' }}>
      {/* Header */}
      <header className="h-14 bg-surface border-b border-th-border flex items-center px-6 gap-4 relative z-50">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-subtle-hover transition-colors text-tx-faint hover:text-tx-primary">
          <ArrowLeft size={18} />
        </button>
        <Crown size={20} className="text-amber-400" />
        <h1 className="text-lg font-bold text-tx-primary font-display">{t.adminTitle}</h1>
        <div className="flex-1" />
        <span className="text-xs text-tx-faint font-mono">{user?.email}</span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar tabs */}
        <nav className="w-56 bg-surface border-r border-th-border flex flex-col p-3 gap-1 shrink-0">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                tab === key ? 'bg-amber-500/10 text-amber-400 font-medium' : 'text-tx-faint hover:bg-subtle-hover hover:text-tx-secondary'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {tab === 'stats' && <StatsTab stats={stats} t={t} />}
          {tab === 'users' && (
            <UsersTab
              users={users}
              currentUserId={user!.id}
              t={t}
              planColors={planColors}
              onBlock={(id, email) => setBlockModal({ userId: id, email })}
              onUnblock={(id) => handleBlock(id, false)}
              onPlanChange={handlePlanChange}
              onAdminToggle={handleAdminToggle}
            />
          )}
          {tab === 'contacts' && (
            <ContactsTab contacts={contacts} t={t} onDelete={handleDeleteContact} />
          )}
          {tab === 'logs' && (
            <LogsTab
              logs={logs}
              total={logsTotal}
              loading={logsLoading}
              category={logsCategory}
              onCategoryChange={(cat) => {
                setLogsCategory(cat);
                setLogs([]);
                fetchLogs(0, cat);
              }}
              onLoadMore={() => fetchLogs(logs.length, logsCategory)}
              t={t}
            />
          )}
          {tab === 'settings' && (
            <SettingsTab
              draft={settingsDraft}
              onChange={setSettingsDraft}
              onSave={handleSaveSettings}
              saving={saving}
              saved={saved}
              t={t}
            />
          )}
        </main>
      </div>

      {/* Block modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setBlockModal(null)}>
          <div className="bg-card border border-th-border-strong rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-400" />
              <h3 className="text-lg font-bold text-tx-primary">{t.adminBlock} — {blockModal.email}</h3>
            </div>
            <label className="block text-sm text-tx-faint mb-2">{t.adminBlockReason}</label>
            <input
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Ex: Abuse, spam..."
              className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBlockModal(null)} className="px-4 py-2 rounded-lg text-sm text-tx-faint hover:bg-subtle-hover transition-colors">
                {t.cancel}
              </button>
              <button
                onClick={() => handleBlock(blockModal.userId, true, blockReason)}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium"
              >
                {t.adminBlock}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stats Tab ────────────────────────────────────────────────────────────── */
function StatsTab({ stats, t }: { stats: AdminStats; t: any }) {
  const cards = [
    { label: t.adminTotalUsers, value: stats.totalUsers, color: 'text-blue-400' },
    { label: t.adminActiveUsers, value: stats.activeUsers, color: 'text-green-400' },
    { label: t.adminBlockedUsers, value: stats.blockedUsers, color: 'text-red-400' },
    { label: t.adminTotalTickets, value: stats.totalTickets, color: 'text-amber-400' },
    { label: t.adminTotalCost, value: `${stats.totalCost.toFixed(2)}$`, color: 'text-amber-400' },
    { label: t.adminTotalTokens, value: fmt(stats.totalTokens), color: 'text-cyan-400' },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6 text-tx-primary">{t.adminStats}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="bg-card border border-th-border rounded-xl p-5">
            <p className="text-xs text-tx-faint mb-1">{c.label}</p>
            <p className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="bg-card border border-th-border rounded-xl p-5 max-w-md">
        <p className="text-sm font-medium text-tx-secondary mb-3">{t.adminPlan} distribution</p>
        <div className="space-y-2">
          {Object.entries(stats.planCounts).map(([plan, count]) => (
            <div key={plan} className="flex items-center justify-between">
              <span className="text-sm text-tx-faint capitalize">{plan}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 rounded-full bg-subtle overflow-hidden">
                  <div
                    className={`h-full rounded-full ${plan === 'free' ? 'bg-gray-500' : plan === 'pro' ? 'bg-amber-500' : 'bg-purple-500'}`}
                    style={{ width: `${stats.totalUsers ? (count / stats.totalUsers) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-tx-secondary w-8 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Users Tab ────────────────────────────────────────────────────────────── */
function UsersTab({
  users, currentUserId, t, planColors, onBlock, onUnblock, onPlanChange, onAdminToggle,
}: {
  users: AdminUser[];
  currentUserId: number;
  t: any;
  planColors: Record<string, string>;
  onBlock: (id: number, email: string) => void;
  onUnblock: (id: number) => void;
  onPlanChange: (id: number, plan: string) => void;
  onAdminToggle: (id: number, isAdmin: boolean) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-6 text-tx-primary">{t.adminUsers} ({users.length})</h2>
      {users.length === 0 ? (
        <p className="text-tx-faint text-sm">{t.adminNoUsers}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-border text-tx-faint text-left">
                <th className="pb-3 pr-4 font-medium">{t.adminEmail}</th>
                <th className="pb-3 pr-4 font-medium">{t.adminRole}</th>
                <th className="pb-3 pr-4 font-medium">{t.adminPlan}</th>
                <th className="pb-3 pr-4 font-medium">{t.adminBlocked}</th>
                <th className="pb-3 pr-4 font-medium">{t.adminStripeStatus}</th>
                <th className="pb-3 pr-4 font-medium">{t.adminLastLogin}</th>
                <th className="pb-3 font-medium">{t.adminActions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-th-border/50 hover:bg-subtle-hover/50 transition-colors">
                  <td className="py-3 pr-4">
                    <span className="text-tx-primary font-mono text-xs">{u.email}</span>
                    {u.id === currentUserId && <span className="ml-2 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">You</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {u.isAdmin ? (
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-medium">{t.adminAdmin}</span>
                    ) : (
                      <span className="text-tx-faint bg-subtle px-2 py-0.5 rounded text-xs">{t.adminUser}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={u.plan}
                      onChange={e => onPlanChange(u.id, e.target.value)}
                      className={`text-xs font-mono px-2 py-1 rounded cursor-pointer border-0 ${planColors[u.plan] || planColors.free}`}
                    >
                      <option value="free">{t.adminFree}</option>
                      <option value="pro">{t.adminPro}</option>
                      <option value="enterprise">{t.adminEnterprise}</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    {u.blocked ? (
                      <div>
                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-xs">{t.adminBlocked}</span>
                        {u.blockedReason && <p className="text-[10px] text-tx-ghost mt-0.5">{u.blockedReason}</p>}
                      </div>
                    ) : (
                      <span className="text-green-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {u.stripeSubscriptionStatus ? (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        u.stripeSubscriptionStatus === 'active' ? 'text-green-400 bg-green-500/10' :
                        u.stripeSubscriptionStatus === 'canceled' ? 'text-red-400 bg-red-500/10' :
                        'text-tx-faint bg-subtle'
                      }`}>
                        {u.stripeSubscriptionStatus}
                      </span>
                    ) : (
                      <span className="text-tx-ghost text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-tx-faint text-xs font-mono">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3">
                    {u.id !== currentUserId && (
                      <div className="flex gap-2">
                        {u.blocked ? (
                          <button
                            onClick={() => onUnblock(u.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-green-400 hover:bg-green-500/10 transition-colors"
                          >
                            <ShieldOff size={13} />
                            {t.adminUnblock}
                          </button>
                        ) : (
                          <button
                            onClick={() => onBlock(u.id, u.email)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Shield size={13} />
                            {t.adminBlock}
                          </button>
                        )}
                        <button
                          onClick={() => onAdminToggle(u.id, !u.isAdmin)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          <Crown size={13} />
                          {u.isAdmin ? t.adminUser : t.adminAdmin}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Contacts Tab ─────────────────────────────────────────────────────────── */
function ContactsTab({ contacts, t, onDelete }: { contacts: ContactMsg[]; t: any; onDelete: (id: number) => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-6 text-tx-primary">{t.adminContacts} ({contacts.length})</h2>
      {contacts.length === 0 ? (
        <p className="text-tx-faint text-sm">{t.adminNoContacts}</p>
      ) : (
        <div className="space-y-3">
          {contacts.map(c => (
            <div key={c.id} className="bg-card border border-th-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-tx-primary">{c.name}</span>
                  <span className="text-tx-faint text-xs ml-3 font-mono">{c.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-tx-ghost font-mono">{new Date(c.created_at).toLocaleString()}</span>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-tx-faint hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-tx-secondary whitespace-pre-wrap">{c.message}</p>
              {c.ip && <p className="text-[10px] text-tx-ghost mt-2 font-mono">IP: {c.ip}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Settings Tab ─────────────────────────────────────────────────────────── */

type SettingFieldNumber = { type: 'number'; key: keyof AdminSettings; label: string; desc: string; min: number; max: number };
type SettingFieldFloat = { type: 'float'; key: keyof AdminSettings; label: string; desc: string; min: number; max: number; step: number };
type SettingFieldToggle = { type: 'toggle'; key: keyof AdminSettings; label: string; desc: string; danger?: boolean };
type SettingFieldSelect = { type: 'select'; key: keyof AdminSettings; label: string; desc: string; options: { value: string; label: string }[] };
type SettingFieldText = { type: 'text'; key: keyof AdminSettings; label: string; desc: string };
type SettingField = SettingFieldNumber | SettingFieldFloat | SettingFieldToggle | SettingFieldSelect | SettingFieldText;

interface SettingsCategory {
  key: string;
  label: string;
  icon: typeof Brain;
  color: string;
  bgTint: string;
  fields: SettingField[];
}

function ToggleSwitch({ checked, onChange, danger }: { checked: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  const activeColor = danger ? 'bg-red-500' : 'bg-amber-500';
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition-all duration-200 ${
        checked ? activeColor : 'bg-subtle-hover'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[21px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

function SettingsCard({ category, draft, onChange, t }: {
  category: SettingsCategory;
  draft: AdminSettings;
  onChange: (s: AdminSettings) => void;
  t: any;
}) {
  const Icon = category.icon;

  return (
    <div className="rounded-2xl border border-th-border bg-card flex flex-col">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className={`w-8 h-8 rounded-lg ${category.bgTint} flex items-center justify-center shrink-0`}>
          <Icon size={15} className={category.color} />
        </div>
        <span className="text-[13px] font-semibold text-tx-primary">{category.label}</span>
      </div>

      {/* Fields */}
      <div className="px-3 pb-3 flex-1">
        <div className="rounded-xl bg-subtle/40 divide-y divide-th-border/30 overflow-hidden">
          {category.fields.map(field => (
            <div key={field.key} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-tx-primary leading-snug">{field.label}</p>
                <p className="text-[10px] text-tx-faint mt-0.5 leading-snug">{field.desc}</p>
              </div>

              {field.type === 'toggle' && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-medium ${
                    (draft[field.key] as number) === 1
                      ? (field.danger ? 'text-red-400' : 'text-amber-400')
                      : 'text-tx-faint'
                  }`}>
                    {(draft[field.key] as number) === 1 ? t.settingsEnabled : t.settingsDisabled}
                  </span>
                  <ToggleSwitch
                    checked={(draft[field.key] as number) === 1}
                    onChange={(v) => onChange({ ...draft, [field.key]: v ? 1 : 0 })}
                    danger={field.danger}
                  />
                </div>
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={draft[field.key] as number}
                  onChange={e => onChange({ ...draft, [field.key]: Math.max(field.min, Math.min(field.max, parseInt(e.target.value) || field.min)) })}
                  className="w-[76px] bg-subtle border border-th-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-tx-primary text-center focus:border-amber-500/50 focus:outline-none transition-colors shrink-0"
                />
              )}

              {field.type === 'float' && (
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={draft[field.key] as number}
                  onChange={e => onChange({ ...draft, [field.key]: Math.max(field.min, Math.min(field.max, parseFloat(e.target.value) || field.min)) })}
                  className="w-[100px] bg-subtle border border-th-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-tx-primary text-center focus:border-amber-500/50 focus:outline-none transition-colors shrink-0"
                />
              )}

              {field.type === 'text' && (
                <input
                  type="text"
                  value={draft[field.key] as string}
                  onChange={e => onChange({ ...draft, [field.key]: e.target.value })}
                  className="w-[160px] bg-subtle border border-th-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-tx-primary focus:border-amber-500/50 focus:outline-none transition-colors shrink-0"
                />
              )}

              {field.type === 'select' && (
                <select
                  value={draft[field.key] as string}
                  onChange={e => onChange({ ...draft, [field.key]: e.target.value })}
                  className="bg-subtle border border-th-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-tx-primary shrink-0 cursor-pointer focus:border-amber-500/50 focus:outline-none transition-colors"
                >
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({
  draft, onChange, onSave, saving, saved, t,
}: {
  draft: AdminSettings;
  onChange: (s: AdminSettings) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  t: any;
}) {
  const categories: SettingsCategory[] = [
    {
      key: 'rateLimiting',
      label: t.settingsCatRateLimiting,
      icon: Shield,
      color: 'text-blue-400',
      bgTint: 'bg-blue-500/10',
      fields: [
        { type: 'number', key: 'max_concurrent_pipelines', label: t.maxPipelines, desc: t.maxPipelinesDesc, min: 1, max: 20 },
        { type: 'number', key: 'max_requests_per_minute', label: t.maxRequests, desc: t.maxRequestsDesc, min: 1, max: 1000 },
        { type: 'number', key: 'max_tickets_per_hour', label: t.maxTickets, desc: t.maxTicketsDesc, min: 1, max: 500 },
        { type: 'number', key: 'contact_limit', label: t.settingsContactLimit, desc: t.settingsContactLimitDesc, min: 1, max: 10 },
        { type: 'number', key: 'contact_window_minutes', label: t.settingsContactWindow, desc: t.settingsContactWindowDesc, min: 15, max: 1440 },
      ],
    },
    {
      key: 'ia',
      label: t.settingsCatIA,
      icon: Brain,
      color: 'text-purple-400',
      bgTint: 'bg-purple-500/10',
      fields: [
        { type: 'select', key: 'default_ai_model', label: t.settingsDefaultModel, desc: t.settingsDefaultModelDesc, options: [{ value: 'claude', label: 'Claude' }, { value: 'gpt', label: 'GPT-5' }] },
        { type: 'number', key: 'ai_review_threshold', label: t.settingsReviewThreshold, desc: t.settingsReviewThresholdDesc, min: 0, max: 100 },
        { type: 'number', key: 'ai_max_tokens', label: t.settingsMaxTokens, desc: t.settingsMaxTokensDesc, min: 1024, max: 32000 },
        { type: 'number', key: 'ai_tokens_complexity', label: t.settingsTokensComplexity, desc: t.settingsTokensComplexityDesc, min: 200, max: 2000 },
        { type: 'number', key: 'ai_tokens_chat', label: t.settingsTokensChat, desc: t.settingsTokensChatDesc, min: 2048, max: 16384 },
        { type: 'number', key: 'ai_tokens_review', label: t.settingsTokensReview, desc: t.settingsTokensReviewDesc, min: 1024, max: 8192 },
      ],
    },
    {
      key: 'models',
      label: t.settingsCatModels,
      icon: Cpu,
      color: 'text-orange-400',
      bgTint: 'bg-orange-500/10',
      fields: [
        { type: 'text', key: 'ai_model_claude_version', label: t.settingsClaudeVersion, desc: t.settingsClaudeVersionDesc },
        { type: 'text', key: 'ai_model_gpt_version', label: t.settingsGptVersion, desc: t.settingsGptVersionDesc },
        { type: 'float', key: 'ai_cost_per_token_claude', label: t.settingsCostClaude, desc: t.settingsCostClaudeDesc, min: 0, max: 1, step: 0.000001 },
        { type: 'float', key: 'ai_cost_per_token_gpt', label: t.settingsCostGpt, desc: t.settingsCostGptDesc, min: 0, max: 1, step: 0.000001 },
      ],
    },
    {
      key: 'security',
      label: t.settingsCatSecurity,
      icon: Lock,
      color: 'text-amber-400',
      bgTint: 'bg-amber-500/10',
      fields: [
        { type: 'toggle', key: 'dev_login_enabled', label: t.settingsDevLogin, desc: t.settingsDevLoginDesc },
        { type: 'toggle', key: 'registration_enabled', label: t.settingsRegistration, desc: t.settingsRegistrationDesc },
        { type: 'number', key: 'session_duration_days', label: t.settingsSessionDuration, desc: t.settingsSessionDurationDesc, min: 1, max: 365 },
        { type: 'number', key: 'auth_code_expiry_minutes', label: t.settingsAuthCodeExpiry, desc: t.settingsAuthCodeExpiryDesc, min: 5, max: 60 },
        { type: 'number', key: 'auth_code_limit', label: t.settingsAuthCodeLimit, desc: t.settingsAuthCodeLimitDesc, min: 3, max: 20 },
        { type: 'number', key: 'auth_code_window_minutes', label: t.settingsAuthCodeWindow, desc: t.settingsAuthCodeWindowDesc, min: 5, max: 60 },
        { type: 'number', key: 'auth_verify_limit', label: t.settingsAuthVerifyLimit, desc: t.settingsAuthVerifyLimitDesc, min: 3, max: 30 },
        { type: 'number', key: 'auth_verify_window_minutes', label: t.settingsAuthVerifyWindow, desc: t.settingsAuthVerifyWindowDesc, min: 5, max: 60 },
      ],
    },
    {
      key: 'pipeline',
      label: t.settingsCatPipeline,
      icon: Workflow,
      color: 'text-cyan-400',
      bgTint: 'bg-cyan-500/10',
      fields: [
        { type: 'toggle', key: 'auto_test_enabled', label: t.settingsAutoTest, desc: t.settingsAutoTestDesc },
        { type: 'toggle', key: 'auto_deploy_enabled', label: t.settingsAutoDeploy, desc: t.settingsAutoDeployDesc },
        { type: 'number', key: 'queue_polling_interval_ms', label: t.settingsQueuePolling, desc: t.settingsQueuePollingDesc, min: 1000, max: 30000 },
        { type: 'number', key: 'test_multiplier_per_file', label: t.settingsTestMultiplier, desc: t.settingsTestMultiplierDesc, min: 1, max: 10 },
      ],
    },
    {
      key: 'git',
      label: t.settingsCatGit,
      icon: GitBranch,
      color: 'text-green-400',
      bgTint: 'bg-green-500/10',
      fields: [
        { type: 'text', key: 'git_default_branch', label: t.settingsGitDefaultBranch, desc: t.settingsGitDefaultBranchDesc },
        { type: 'text', key: 'git_target_branch', label: t.settingsGitTargetBranch, desc: t.settingsGitTargetBranchDesc },
        { type: 'select', key: 'git_merge_strategy', label: t.settingsGitMergeStrategy, desc: t.settingsGitMergeStrategyDesc, options: [{ value: 'merge_commit', label: 'Merge commit' }, { value: 'squash', label: 'Squash' }, { value: 'fast_forward', label: 'Fast-forward' }] },
        { type: 'toggle', key: 'git_pr_close_source_branch', label: t.settingsGitCloseBranch, desc: t.settingsGitCloseBranchDesc },
        { type: 'number', key: 'branch_name_max_length', label: t.settingsBranchMaxLength, desc: t.settingsBranchMaxLengthDesc, min: 15, max: 100 },
      ],
    },
    {
      key: 'autoRepo',
      label: t.settingsCatAutoRepo,
      icon: GitFork,
      color: 'text-teal-400',
      bgTint: 'bg-teal-500/10',
      fields: [
        { type: 'toggle', key: 'auto_repo_enabled', label: t.settingsAutoRepoEnabled, desc: t.settingsAutoRepoEnabledDesc },
        { type: 'toggle', key: 'auto_repo_default_private', label: t.settingsAutoRepoDefaultPrivate, desc: t.settingsAutoRepoDefaultPrivateDesc },
      ],
    },
    {
      key: 'interface',
      label: t.settingsCatInterface,
      icon: Monitor,
      color: 'text-indigo-400',
      bgTint: 'bg-indigo-500/10',
      fields: [
        { type: 'number', key: 'notification_timeout_ms', label: t.settingsNotifTimeout, desc: t.settingsNotifTimeoutDesc, min: 2000, max: 15000 },
        { type: 'number', key: 'score_threshold_good', label: t.settingsScoreGood, desc: t.settingsScoreGoodDesc, min: 50, max: 100 },
        { type: 'number', key: 'score_threshold_ok', label: t.settingsScoreOk, desc: t.settingsScoreOkDesc, min: 20, max: 80 },
        { type: 'number', key: 'activity_preview_length', label: t.settingsActivityPreview, desc: t.settingsActivityPreviewDesc, min: 20, max: 200 },
        { type: 'number', key: 'audit_log_default_limit', label: t.settingsAuditLogLimit, desc: t.settingsAuditLogLimitDesc, min: 10, max: 100 },
        { type: 'number', key: 'audit_log_max_limit', label: t.settingsAuditLogMaxLimit, desc: t.settingsAuditLogMaxLimitDesc, min: 100, max: 1000 },
      ],
    },
    {
      key: 'maintenance',
      label: t.settingsCatMaintenance,
      icon: Wrench,
      color: 'text-red-400',
      bgTint: 'bg-red-500/10',
      fields: [
        { type: 'toggle', key: 'maintenance_mode', label: t.settingsMaintenanceMode, desc: t.settingsMaintenanceModeDesc, danger: true },
        { type: 'number', key: 'log_retention_days', label: t.settingsLogRetention, desc: t.settingsLogRetentionDesc, min: 7, max: 365 },
      ],
    },
  ];

  const totalFields = categories.reduce((sum, c) => sum + c.fields.length, 0) + 12; // +12 for plans (4 rows x 3 plans)

  return (
    <div className="h-full flex flex-col">
      {/* Header — centré */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-tx-primary font-display">{t.adminSettings}</h2>
        <p className="text-[11px] text-tx-faint mt-1">{totalFields} settings &middot; {categories.length + 1} categories</p>
      </div>

      {/* Grille 2 colonnes */}
      <div className="flex-1 grid grid-cols-2 gap-3 auto-rows-min content-start">
        {categories.map(cat => (
          <SettingsCard key={cat.key} category={cat} draft={draft} onChange={onChange} t={t} />
        ))}

        {/* Plans — pleine largeur */}
        <div className="col-span-2">
          <PlansCard draft={draft} onChange={onChange} t={t} />
        </div>
      </div>

      {/* Save */}
      <div className="mt-5 flex justify-center pb-2">
        <button
          onClick={onSave}
          disabled={saving}
          className={`px-8 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 disabled:opacity-50 ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gradient-to-r from-amber-500 to-red-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {saving ? t.saving : saved ? t.savedOk : t.save}
        </button>
      </div>
    </div>
  );
}

/* ── Plans Card ────────────────────────────────────────────────────────── */
function PlansCard({ draft, onChange, t }: { draft: AdminSettings; onChange: (s: AdminSettings) => void; t: any }) {
  const plans = [
    { key: 'free', label: t.adminFree, color: 'text-gray-400', ticketsKey: 'plan_free_tickets' as const, pipelinesKey: 'plan_free_pipelines' as const, projectsKey: 'plan_free_projects' as const, membersKey: 'plan_free_members' as const, ticketsMin: 1, ticketsMax: 1000 },
    { key: 'pro', label: t.adminPro, color: 'text-amber-400', ticketsKey: 'plan_pro_tickets' as const, pipelinesKey: 'plan_pro_pipelines' as const, projectsKey: 'plan_pro_projects' as const, membersKey: 'plan_pro_members' as const, ticketsMin: 1, ticketsMax: 1000 },
    { key: 'enterprise', label: t.adminEnterprise, color: 'text-purple-400', ticketsKey: 'plan_enterprise_tickets' as const, pipelinesKey: 'plan_enterprise_pipelines' as const, projectsKey: 'plan_enterprise_projects' as const, membersKey: 'plan_enterprise_members' as const, ticketsMin: -1, ticketsMax: 1000 },
  ];

  return (
    <div className="rounded-2xl border border-th-border bg-card flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <CreditCard size={15} className="text-emerald-400" />
        </div>
        <span className="text-[13px] font-semibold text-tx-primary">{t.settingsCatPlans}</span>
      </div>
      <div className="px-3 pb-3">
        <div className="rounded-xl bg-subtle/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-border/30">
                <th className="px-4 py-3 text-left text-[11px] font-medium text-tx-faint w-1/4" />
                {plans.map(p => (
                  <th key={p.key} className="px-4 py-3 text-center text-[11px] font-medium w-1/4">
                    <span className={p.color}>{p.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-th-border/30">
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium text-tx-primary">{t.settingsTicketsPerMonth}</p>
                </td>
                {plans.map(p => (
                  <td key={p.key} className="px-4 py-3 text-center">
                    {p.key === 'enterprise' && (draft[p.ticketsKey] as number) === -1 ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs font-medium text-purple-400">{t.settingsUnlimited}</span>
                        <button
                          onClick={() => onChange({ ...draft, [p.ticketsKey]: 100 })}
                          className="text-[10px] text-tx-ghost hover:text-tx-faint transition-colors"
                          title="Définir une limite"
                        >✏️</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={p.ticketsMin}
                          max={p.ticketsMax}
                          value={draft[p.ticketsKey] as number}
                          onChange={e => onChange({ ...draft, [p.ticketsKey]: Math.max(p.ticketsMin, Math.min(p.ticketsMax, parseInt(e.target.value) || p.ticketsMin)) })}
                          className="w-[72px] bg-subtle border border-th-border rounded-lg px-2 py-1.5 text-xs font-mono text-tx-primary text-center focus:border-amber-500/50 focus:outline-none transition-colors"
                        />
                        {p.key === 'enterprise' && (
                          <button
                            onClick={() => onChange({ ...draft, [p.ticketsKey]: -1 })}
                            className="text-[10px] text-tx-ghost hover:text-purple-400 transition-colors ml-1"
                            title="Illimité"
                          >∞</button>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-th-border/30">
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium text-tx-primary">{t.settingsPipelinesPerPlan}</p>
                </td>
                {plans.map(p => (
                  <td key={p.key} className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={draft[p.pipelinesKey] as number}
                      onChange={e => onChange({ ...draft, [p.pipelinesKey]: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                      className="w-[72px] bg-subtle border border-th-border rounded-lg px-2 py-1.5 text-xs font-mono text-tx-primary text-center focus:border-amber-500/50 focus:outline-none transition-colors"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-th-border/30">
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium text-tx-primary">{t.settingsProjectsPerPlan}</p>
                </td>
                {plans.map(p => (
                  <td key={p.key} className="px-4 py-3 text-center">
                    {p.key === 'enterprise' && (draft[p.projectsKey] as number) === -1 ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs font-medium text-purple-400">{t.settingsUnlimited}</span>
                        <button
                          onClick={() => onChange({ ...draft, [p.projectsKey]: 10 })}
                          className="text-[10px] text-tx-ghost hover:text-tx-faint transition-colors"
                          title="Définir une limite"
                        >✏️</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={p.key === 'enterprise' ? -1 : 1}
                          max={100}
                          value={draft[p.projectsKey] as number}
                          onChange={e => onChange({ ...draft, [p.projectsKey]: Math.max(p.key === 'enterprise' ? -1 : 1, Math.min(100, parseInt(e.target.value) || 1)) })}
                          className="w-[72px] bg-subtle border border-th-border rounded-lg px-2 py-1.5 text-xs font-mono text-tx-primary text-center focus:border-amber-500/50 focus:outline-none transition-colors"
                        />
                        {p.key === 'enterprise' && (
                          <button
                            onClick={() => onChange({ ...draft, [p.projectsKey]: -1 })}
                            className="text-[10px] text-tx-ghost hover:text-purple-400 transition-colors ml-1"
                            title="Illimité"
                          >∞</button>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium text-tx-primary">{t.settingsMembersPerProject}</p>
                </td>
                {plans.map(p => (
                  <td key={p.key} className="px-4 py-3 text-center">
                    {p.key === 'enterprise' && (draft[p.membersKey] as number) === -1 ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs font-medium text-purple-400">{t.settingsUnlimited}</span>
                        <button
                          onClick={() => onChange({ ...draft, [p.membersKey]: 10 })}
                          className="text-[10px] text-tx-ghost hover:text-tx-faint transition-colors"
                          title="Définir une limite"
                        >✏️</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={p.key === 'enterprise' ? -1 : 1}
                          max={100}
                          value={draft[p.membersKey] as number}
                          onChange={e => onChange({ ...draft, [p.membersKey]: Math.max(p.key === 'enterprise' ? -1 : 1, Math.min(100, parseInt(e.target.value) || 1)) })}
                          className="w-[72px] bg-subtle border border-th-border rounded-lg px-2 py-1.5 text-xs font-mono text-tx-primary text-center focus:border-amber-500/50 focus:outline-none transition-colors"
                        />
                        {p.key === 'enterprise' && (
                          <button
                            onClick={() => onChange({ ...draft, [p.membersKey]: -1 })}
                            className="text-[10px] text-tx-ghost hover:text-purple-400 transition-colors ml-1"
                            title="Illimité"
                          >∞</button>
                        )}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Logs Tab ──────────────────────────────────────────────────────────── */
function LogsTab({ logs, total, loading, category, onCategoryChange, onLoadMore, t }: {
  logs: AuditLog[]; total: number; loading: boolean;
  category: string; onCategoryChange: (cat: string) => void;
  onLoadMore: () => void; t: any;
}) {
  const actionColors: Record<string, string> = {
    login: 'text-green-400 bg-green-500/10',
    dev_login: 'text-green-400 bg-green-500/10',
    dev_login_client: 'text-green-400 bg-green-500/10',
    ticket_create: 'text-blue-400 bg-blue-500/10',
    ticket_update: 'text-amber-400 bg-amber-500/10',
    ticket_delete: 'text-red-400 bg-red-500/10',
    pipeline_launch: 'text-cyan-400 bg-cyan-500/10',
    pipeline_approve: 'text-green-400 bg-green-500/10',
    pipeline_reject: 'text-red-400 bg-red-500/10',
    pipeline_retry: 'text-amber-400 bg-amber-500/10',
    pipeline_rollback: 'text-orange-400 bg-orange-500/10',
    user_block: 'text-red-400 bg-red-500/10',
    user_unblock: 'text-green-400 bg-green-500/10',
    user_plan_change: 'text-purple-400 bg-purple-500/10',
    user_promote_admin: 'text-amber-400 bg-amber-500/10',
    user_demote_admin: 'text-gray-400 bg-gray-500/10',
    onboard_feedback: 'text-indigo-400 bg-indigo-500/10',
    project_create: 'text-emerald-400 bg-emerald-500/10',
    project_update: 'text-emerald-400 bg-emerald-500/10',
    project_invite: 'text-teal-400 bg-teal-500/10',
    project_join: 'text-teal-400 bg-teal-500/10',
    project_delete: 'text-red-400 bg-red-500/10',
    comment_delete: 'text-red-400 bg-red-500/10',
    contact_delete: 'text-red-400 bg-red-500/10',
    ticket_reorder: 'text-blue-300 bg-blue-400/10',
  };

  const categories = [
    { key: 'all', label: t.adminLogFilterAll, color: 'text-tx-secondary border-tx-faint' },
    { key: 'auth', label: t.adminLogFilterAuth, color: 'text-green-400 border-green-500/40' },
    { key: 'ticket', label: t.adminLogFilterTicket, color: 'text-blue-400 border-blue-500/40' },
    { key: 'project', label: t.adminLogFilterProject, color: 'text-emerald-400 border-emerald-500/40' },
    { key: 'pipeline', label: t.adminLogFilterPipeline, color: 'text-cyan-400 border-cyan-500/40' },
    { key: 'admin', label: t.adminLogFilterAdmin, color: 'text-amber-400 border-amber-500/40' },
    { key: 'delete', label: t.adminLogFilterDelete, color: 'text-red-400 border-red-500/40' },
    { key: 'feedback', label: t.adminLogFilterFeedback, color: 'text-indigo-400 border-indigo-500/40' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-tx-primary">{t.adminLogs} ({total})</h2>
      </div>
      {/* Filter chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(cat.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              category === cat.key
                ? `${cat.color} bg-white/5 border-current`
                : 'text-tx-faint border-th-border hover:bg-subtle-hover hover:text-tx-secondary'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {logs.length === 0 ? (
        <p className="text-tx-faint text-sm">{t.adminNoLogs}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border text-tx-faint text-left">
                  <th className="pb-3 pr-4 font-medium w-40">{t.adminLogDate}</th>
                  <th className="pb-3 pr-4 font-medium">{t.adminLogAction}</th>
                  <th className="pb-3 pr-4 font-medium">{t.adminLogUser}</th>
                  <th className="pb-3 pr-4 font-medium">{t.adminLogEntity}</th>
                  <th className="pb-3 pr-4 font-medium">{t.adminLogDetails}</th>
                  <th className="pb-3 font-medium">{t.adminLogIp}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-th-border/50 hover:bg-subtle-hover/50 transition-colors">
                    <td className="py-2.5 pr-4 text-tx-faint text-xs font-mono whitespace-nowrap">
                      {new Date(log.created_at + 'Z').toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${actionColors[log.action] || 'text-tx-faint bg-subtle'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-tx-secondary text-xs font-mono truncate max-w-[180px]">
                      {log.user_email}
                    </td>
                    <td className="py-2.5 pr-4 text-tx-faint text-xs font-mono">
                      {log.entity_type && <>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</>}
                    </td>
                    <td className="py-2.5 pr-4 text-tx-faint text-xs max-w-[250px] truncate" title={log.details || ''}>
                      {log.details}
                    </td>
                    <td className="py-2.5 text-tx-ghost text-xs font-mono">
                      {log.ip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length < total && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm text-tx-faint border border-th-border hover:bg-subtle-hover transition-colors disabled:opacity-40"
              >
                {loading ? '...' : t.adminLoadMore} ({logs.length}/{total})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
