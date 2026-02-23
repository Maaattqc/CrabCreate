import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, List, LayoutGrid, Sun, Moon, LogOut, ChevronDown, Globe, Sparkles, Palette, User, Crown, CreditCard, ArrowUpRight, FolderKanban, Plus, Settings, Mail, Calendar, Clock, Download } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useAnimations } from '../../hooks/useAnimations';
import { useAIDesign } from '../../hooks/useAIDesign';
import { useAuth } from '../../hooks/useAuth';
import { useProject } from '../../hooks/useProject';
import { useLoginModal } from '../../hooks/useLoginModal';
import PresenceAvatars from './PresenceAvatars';
import NotificationBell from './NotificationBell';
import type { Ticket, PresenceUser } from '../../types';

interface Stats {
  totalCost: number;
  totalTokens: number;
  totalLines: number;
  avgScore: number | null;
}

type ViewMode = 'board' | 'list' | 'calendar' | 'timeline';

interface HeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  tickets: Ticket[] | null;
  showMascot: boolean;
  onToggleMascot: (v: boolean) => void;
  onCmdK?: () => void;
  onCreateProject?: () => void;
  onOpenProjectSettings?: () => void;
  onOpenInvitations?: () => void;
  presenceUsers?: PresenceUser[];
  onNotificationTicketClick?: (ticketId: number, tab?: string) => void;
}

function computeStats(tickets: Ticket[] | null): Stats | null {
  if (!tickets) return null;
  const totalCost = tickets.reduce((sum, t) => sum + (t.cost_usd || 0), 0);
  const totalTokens = tickets.reduce((sum, t) => sum + (t.tokens_used || 0), 0);
  const totalLines = tickets.reduce((sum, t) => sum + (t.lines_added || 0) + (t.lines_removed || 0), 0);
  const scored = tickets.filter(t => t.ai_review_score != null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, t) => s + (t.ai_review_score as number), 0) / scored.length) : null;
  return { totalCost, totalTokens, totalLines, avgScore };
}

/* Animated counter hook */
function useAnimatedNumber(target: number, duration = 800): number {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const val = start + diff * eased;
      setDisplay(val);
      if (t < 1) raf = requestAnimationFrame(step);
      else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

export default function Header({ search, onSearchChange, viewMode, onViewModeChange, tickets, showMascot, onToggleMascot, onCmdK, onCreateProject, onOpenProjectSettings, onOpenInvitations, presenceUsers, onNotificationTicketClick }: HeaderProps) {
  const { theme, toggle: toggleTheme } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const { animations, setAnimations } = useAnimations();
  const { aiDesign, setAIDesign } = useAIDesign();
  const { user, logout, updatePreferences, refreshSession } = useAuth();
  const { openLogin } = useLoginModal();
  const { projects, currentProject, invitations, switchProject } = useProject();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const stats = computeStats(tickets);

  const hasActive = tickets?.some(tk => ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying'].includes(tk.status));

  const animCost = useAnimatedNumber(stats?.totalCost ?? 0);
  const animTokens = useAnimatedNumber(stats?.totalTokens ?? 0);
  const animLines = useAnimatedNumber(stats?.totalLines ?? 0);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) setProjectMenuOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    if (menuOpen || projectMenuOpen || exportOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, projectMenuOpen, exportOpen]);

  const handleToggleTheme = () => {
    toggleTheme();
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: newTheme }).catch(() => {});
  };

  const handleToggleLang = () => {
    const newLang = lang === 'fr' ? 'en' : 'fr';
    setLang(newLang);
    updatePreferences({ lang: newLang }).catch(() => {});
  };

  const handleToggleAnimations = () => {
    setAnimations(!animations);
    updatePreferences({ animations: !animations }).catch(() => {});
  };

  const handleToggleAIDesign = () => {
    setAIDesign(!aiDesign);
    updatePreferences({ aiDesign: !aiDesign }).catch(() => {});
  };

  const resolveBillingError = async (raw: unknown): Promise<string> => {
    const errorMessage = typeof raw === 'string' ? raw : '';
    if (errorMessage === 'Already on Pro plan') {
      await refreshSession().catch(() => {});
      return t.billingAlreadyOnPro;
    }
    return errorMessage || t.error;
  };

  const redirectToStripeIfSafe = (url: unknown): boolean => {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
      const parsed = new URL(url);
      if (['checkout.stripe.com', 'billing.stripe.com'].includes(parsed.hostname)) {
        window.location.href = url;
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const openBillingPortal = async () => {
    setBillingNotice(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingNotice(await resolveBillingError((data as { error?: unknown }).error));
        return;
      }
      if (!redirectToStripeIfSafe((data as { url?: unknown }).url)) {
        setBillingNotice(t.error);
      }
    } catch {
      setBillingNotice(t.error);
    }
  };

  const startBillingCheckout = async () => {
    setBillingNotice(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBillingNotice(await resolveBillingError((data as { error?: unknown }).error));
        return;
      }
      if (!redirectToStripeIfSafe((data as { url?: unknown }).url)) {
        setBillingNotice(t.error);
      }
    } catch {
      setBillingNotice(t.error);
    }
  };

  return (
    <header className={`h-14 bg-surface border-b border-th-border flex items-center px-3 gap-2 sm:px-4 sm:gap-3 lg:px-6 lg:gap-5 relative z-50 ${aiDesign ? 'ai-glass-header' : ''}`}>
      {/* Logo + optional AI orb */}
      <div className="flex items-center gap-2.5">
        <span className="brand-emoji text-lg leading-none" aria-hidden="true">🦀</span>
        <span className="hidden sm:inline text-base sm:text-lg font-extrabold bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent font-display tracking-tight anim-logo">CrabCreate</span>
        {aiDesign && (
          <div className={`ai-orb ${hasActive ? '' : 'ai-orb-idle'}`}>
            <div className="ai-orb-ring" />
            <div className="ai-orb-core" />
          </div>
        )}
      </div>

      {/* Project selector */}
      {currentProject && (
        <div className="relative" ref={projectMenuRef}>
          <button
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-th-border hover:bg-subtle-hover transition-colors max-w-[120px] sm:max-w-[180px]"
          >
            <FolderKanban size={14} className="text-amber-400 shrink-0" />
            <span className="text-xs text-tx-secondary truncate">{currentProject.name}</span>
            <ChevronDown size={12} className={`text-tx-faint shrink-0 transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`} />
            {invitations.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shrink-0">{invitations.length}</span>
            )}
          </button>

          {projectMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-card border border-th-border-strong rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-[fadeSlideIn_0.15s_ease-out]">
              <div className="p-2 max-h-[300px] overflow-y-auto space-y-0.5">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { switchProject(p); setProjectMenuOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${p.id === currentProject.id ? 'bg-amber-500/10 text-amber-400' : 'text-tx-secondary hover:bg-subtle-hover'}`}
                  >
                    <FolderKanban size={14} className={p.id === currentProject.id ? 'text-amber-400' : 'text-tx-faint'} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{p.name}</span>
                      <span className="text-[10px] text-tx-faint">{p.role}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-th-border p-2 space-y-0.5">
                {onCreateProject && (
                  <button
                    onClick={() => { onCreateProject(); setProjectMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Plus size={14} /> {t.projectCreate}
                  </button>
                )}
                {onOpenProjectSettings && (currentProject.role === 'owner' || currentProject.role === 'admin') && (
                  <button
                    onClick={() => { onOpenProjectSettings(); setProjectMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-tx-secondary hover:bg-subtle-hover transition-colors"
                  >
                    <Settings size={14} /> {t.projectSettings}
                  </button>
                )}
                {invitations.length > 0 && onOpenInvitations && (
                  <button
                    onClick={() => { onOpenInvitations(); setProjectMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-tx-secondary hover:bg-subtle-hover transition-colors"
                  >
                    <Mail size={14} /> {t.projectInvitationsBadge}
                    <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{invitations.length}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage stats */}
      {stats && (
        <div className="hidden lg:flex items-center gap-5 text-sm">
          <span className="text-tx-muted">{t.credit} <span className="font-mono font-semibold text-amber-400 anim-stat">{aiDesign ? animCost.toFixed(2) : stats.totalCost.toFixed(2)}$</span><span className="text-tx-faint">/100$</span></span>
          <span className="text-tx-muted">{t.tokens} <span className="font-mono font-semibold text-tx-secondary">{aiDesign ? fmt(animTokens) : fmt(stats.totalTokens)}</span></span>
          <span className="text-tx-muted">{t.lines} <span className="font-mono font-semibold text-tx-secondary">{aiDesign ? fmt(animLines) : fmt(stats.totalLines)}</span></span>
          <span className="text-tx-muted">{t.score} <span className={`font-mono font-semibold ${stats.avgScore == null ? 'text-tx-faint' : stats.avgScore >= 70 ? 'text-green-400' : stats.avgScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{stats.avgScore != null ? stats.avgScore + '/100' : '—'}</span></span>
        </div>
      )}

      {/* Online presence avatars */}
      {presenceUsers && presenceUsers.length > 0 && (
        <div className="hidden sm:flex">
          <PresenceAvatars users={presenceUsers} maxVisible={currentProject?.presence_max_visible} />
        </div>
      )}

      {/* Notification bell */}
      <NotificationBell onTicketClick={onNotificationTicketClick} />

      <div className="flex-1" />

      {/* Search / Ctrl+K */}
      <div className="relative hidden sm:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-faint" />
        {aiDesign && onCmdK ? (
          <button
            onClick={onCmdK}
            className="bg-subtle border border-th-border-strong rounded-lg pl-10 pr-4 py-2 text-sm text-tx-faint w-48 md:w-56 lg:w-64 text-left flex items-center justify-between hover:border-th-border transition-colors"
          >
            <span>{t.search}</span>
            <kbd className="text-[10px] text-tx-ghost bg-subtle-hover px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
          </button>
        ) : (
          <input
            type="text"
            placeholder={t.search}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-subtle border border-th-border-strong rounded-lg pl-10 pr-4 py-2 text-sm text-tx-secondary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 w-48 md:w-56 lg:w-64"
          />
        )}
      </div>

      {/* View mode toggle */}
      {onViewModeChange && (
        <div className="hidden sm:flex bg-subtle rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('board')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'board' ? 'bg-subtle-hover text-tx-primary' : 'text-tx-faint hover:text-tx-tertiary'}`}
            title={t.viewBoard}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-subtle-hover text-tx-primary' : 'text-tx-faint hover:text-tx-tertiary'}`}
            title={t.viewList}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-subtle-hover text-tx-primary' : 'text-tx-faint hover:text-tx-tertiary'}`}
            title={t.viewCalendar}
          >
            <Calendar size={16} />
          </button>
          {/* Timeline button hidden – view code kept */}
        </div>
      )}

      {/* Export dropdown */}
      <div className="hidden sm:block relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen(!exportOpen)}
          className="p-2 rounded-lg text-tx-faint hover:bg-subtle-hover hover:text-tx-tertiary transition-colors"
          title={t.exportTitle}
        >
          <Download size={16} />
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-th-border-strong rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-[fadeSlideIn_0.15s_ease-out]">
            <div className="p-1.5">
              <button
                onClick={async () => {
                  try {
                    const { exportCSV } = await import('../../api/export');
                    await exportCSV();
                  } catch { /* ignore */ }
                  setExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-tx-secondary hover:bg-subtle-hover transition-colors"
              >
                {t.exportCSV}
              </button>
              <button
                onClick={async () => {
                  try {
                    const { exportPDF } = await import('../../api/export');
                    await exportPDF();
                  } catch { /* ignore */ }
                  setExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-tx-secondary hover:bg-subtle-hover transition-colors"
              >
                {t.exportPDF}
              </button>
              <button
                onClick={async () => {
                  try {
                    const { exportHTML } = await import('../../api/export');
                    await exportHTML();
                  } catch { /* ignore */ }
                  setExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-tx-secondary hover:bg-subtle-hover transition-colors"
              >
                {t.exportHTML}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Login button for visitors */}
      {!user && (
        <button
          onClick={openLogin}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
        >
          <User size={14} />
          {t.navLogin}
        </button>
      )}

      {/* User menu */}
      {user && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen(prev => {
                const next = !prev;
                if (next) {
                  setBillingNotice(null);
                  refreshSession().catch(() => {});
                }
                return next;
              });
            }}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-th-border hover:bg-subtle-hover transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center">
              <User size={12} className="text-white" />
            </div>
            <span className="text-xs text-tx-faint truncate max-w-[120px] hidden sm:block">{user.email}</span>
            <ChevronDown size={14} className={`text-tx-faint transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-th-border-strong rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-[fadeSlideIn_0.15s_ease-out]">
              {/* Email header */}
              <div className="px-4 py-3 border-b border-th-border">
                <p className="text-sm font-medium text-tx-primary truncate">{user.email}</p>
                {user.isAdmin && <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">Admin</span>}
              </div>

              {/* Toggles */}
              <div className="p-2 space-y-0.5">
                {/* Language */}
                <button
                  onClick={handleToggleLang}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe size={16} className="text-tx-faint" />
                    <span className="text-sm text-tx-secondary">{t.userMenuLang}</span>
                  </div>
                  <span className="text-xs font-mono text-tx-faint bg-subtle px-2 py-0.5 rounded">{lang.toUpperCase()}</span>
                </button>

                {/* Theme */}
                <button
                  onClick={handleToggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon size={16} className="text-tx-faint" /> : <Sun size={16} className="text-tx-faint" />}
                    <span className="text-sm text-tx-secondary">{t.userMenuTheme}</span>
                  </div>
                  <span className="text-xs font-mono text-tx-faint bg-subtle px-2 py-0.5 rounded">{theme === 'dark' ? t.darkMode : t.lightMode}</span>
                </button>

                {/* Animations */}
                <button
                  onClick={handleToggleAnimations}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={16} className="text-tx-faint" />
                    <span className="text-sm text-tx-secondary">{t.userMenuAnimations}</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${animations ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-tx-ghost'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200 ${animations ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'}`} />
                  </div>
                </button>

                {/* AI Design */}
                <button
                  onClick={handleToggleAIDesign}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Palette size={16} className="text-tx-faint" />
                    <span className="text-sm text-tx-secondary">{t.userMenuAIDesign}</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${aiDesign ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-tx-ghost'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200 ${aiDesign ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'}`} />
                  </div>
                </button>

                {/* Mascot */}
                <button
                  onClick={() => { onToggleMascot(!showMascot); updatePreferences({ mascot: !showMascot }).catch(() => {}); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="ui-emoji text-base leading-none w-4 text-center">🦀</span>
                    <span className="text-sm text-tx-secondary">{t.userMenuMascot}</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${showMascot ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-tx-ghost'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200 ${showMascot ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'}`} />
                  </div>
                </button>
              </div>

              {/* Billing section */}
              <div className="border-t border-th-border mx-2" />
              <div className="p-2 space-y-0.5">
                {/* Plan badge */}
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    <CreditCard size={16} className="text-tx-faint" />
                    <span className="text-sm text-tx-secondary">{t.billingCurrentPlan}</span>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    user.plan === 'pro' ? 'text-amber-400 bg-amber-500/10' :
                    user.plan === 'enterprise' ? 'text-purple-400 bg-purple-500/10' :
                    'text-tx-faint bg-subtle'
                  }`}>
                    {user.plan === 'pro' ? 'Pro' : user.plan === 'enterprise' ? 'Enterprise' : 'Free'}
                  </span>
                </div>

                {user.plan !== 'free' && (
                  <button
                    onClick={openBillingPortal}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-subtle-hover transition-colors"
                  >
                    <ArrowUpRight size={16} className="text-tx-faint" />
                    <span className="text-sm text-tx-secondary">{t.billingManage}</span>
                  </button>
                )}

                {user.plan === 'free' && (
                  <button
                    onClick={startBillingCheckout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-amber-500/10 transition-colors"
                  >
                    <ArrowUpRight size={16} className="text-amber-400" />
                    <span className="text-sm text-amber-400 font-medium">{t.billingUpgradeToPro}</span>
                  </button>
                )}

                {billingNotice && (
                  <p className="px-3 pt-1 text-[11px] leading-4 text-amber-400">{billingNotice}</p>
                )}
              </div>

              {/* Admin section */}
              {user.isAdmin && (
                <>
                  <div className="border-t border-th-border mx-2" />
                  <div className="p-2">
                    <button
                      onClick={() => { window.location.href = '/admin'; }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      <Crown size={16} className="text-amber-400" />
                      <span className="text-sm text-amber-400 font-medium">{t.adminTitle}</span>
                    </button>
                  </div>
                </>
              )}

              {/* Logout */}
              <div className="border-t border-th-border mx-2" />
              <div className="p-2">
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-400"
                >
                  <LogOut size={16} />
                  <span className="text-sm">{t.authLogout}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline keyframes for menu animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}


