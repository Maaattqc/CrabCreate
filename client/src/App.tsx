import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import NotificationToast from './components/layout/NotificationToast';
import FileLockBanner from './components/board/FileLockBanner';
import KanbanBoard from './components/board/KanbanBoard';
import ListView from './components/board/ListView';
import CalendarView from './components/board/CalendarView';
import TimelineView from './components/board/TimelineView';
import CreateTicketModal from './components/modals/CreateTicketModal';
import TicketDetailModal from './components/modals/TicketDetailModal';
import CreateProjectModal from './components/modals/CreateProjectModal';
import ProjectSettingsModal from './components/modals/ProjectSettingsModal';
import InvitationsModal from './components/modals/InvitationsModal';
import ProjectSetupModal from './components/modals/ProjectSetupModal';
import CommandPalette from './components/layout/CommandPalette';
import LiveActivityBar from './components/layout/LiveActivityBar';
import CrabMascot from './components/layout/CrabMascot';
import Onboarding from './components/layout/Onboarding';
import LoginPage from './components/auth/LoginPage';
import PublicNavbar from './components/public/PublicNavbar';
import Footer from './components/public/Footer';
import LandingPage from './components/public/LandingPage';
import PricingPage from './components/public/PricingPage';
import ContactPage from './components/public/ContactPage';
import LegalPage from './components/public/LegalPage';
import PrivacyPage from './components/public/PrivacyPage';
import NotFoundPage from './components/public/NotFoundPage';
import AdminPage from './components/admin/AdminPage';
import LiveCursors from './components/layout/LiveCursors';
import { useCursors } from './hooks/useCursors';
import { useTickets } from './hooks/useTickets';
import { useSocket } from './hooks/useSocket';
import { useNotifications } from './hooks/useNotifications';
import { ThemeProvider } from './hooks/useTheme';
import { LanguageProvider, useLanguage } from './hooks/useLanguage';
import { AnimationsProvider } from './hooks/useAnimations';
import { AIDesignProvider, useAIDesign } from './hooks/useAIDesign';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ProjectProvider, useProject } from './hooks/useProject';
import { LoginModalProvider, useLoginModal } from './hooks/useLoginModal';
import { getSetupStatus } from './api/project-setup';
import type { Ticket } from './types';

/** Layout wrapper for public pages (navbar + footer) */
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      <PublicNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Protects routes — redirects to /dashboard if not authenticated */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-5xl mb-4 animate-bounce">🦀</div>
        <p className="text-tx-faint text-sm">{t.authLoading}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** Protects admin routes — redirects non-admin users to /dashboard */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-5xl mb-4 animate-bounce">🦀</div>
        <p className="text-tx-faint text-sm">{t.authLoading}</p>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** Main dashboard */
function Dashboard() {
  const { user, refreshSession } = useAuth();
  const { openLogin } = useLoginModal();
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar' | 'timeline'>('board');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTicketTab, setSelectedTicketTab] = useState<string | undefined>(undefined);
  const [showCmd, setShowCmd] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [pendingLaunchId, setPendingLaunchId] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem('crab-onboarded');
  });
  const demoTicketIdRef = useRef<number | null>(null);

  // Re-check onboarding when user logs in (e.g. "Nouveau client" removes crab-onboarded then activates session)
  useEffect(() => {
    if (user && !localStorage.getItem('crab-onboarded')) {
      setShowOnboarding(true);
    }
  }, [user]);

  const [showMascot, setShowMascot] = useState<boolean>(() => {
    const saved = localStorage.getItem('crab-mascot');
    return saved === null ? true : saved === 'true';
  });

  const toggleMascot = (v: boolean) => {
    setShowMascot(v);
    localStorage.setItem('crab-mascot', String(v));
  };

  const [appConfig, setAppConfig] = useState<{ notification_timeout_ms: number; score_threshold_good: number; score_threshold_ok: number }>({
    notification_timeout_ms: 5000, score_threshold_good: 70, score_threshold_ok: 50,
  });

  useEffect(() => {
    fetch('/api/app-config', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAppConfig(data); })
      .catch(() => {});
  }, []);

  const { cursors, presence, sendCursorMove, sendCursorLeave } = useCursors();
  const { tickets, fetchTickets, resetAndFetch, create, remove, launch, approve, reject, retry, rollback, updateTicketInState, insertLocalTicket, removeLocalTicket, reorder, clearTickets } = useTickets();
  const { notifications, addNotification, removeNotification } = useNotifications(appConfig.notification_timeout_ms);
  const { on, off, emit } = useSocket();
  const { t } = useLanguage();
  const { aiDesign } = useAIDesign();
  const { currentProject, loading: projectsLoading } = useProject();

  // Clear tickets visually on logout
  useEffect(() => {
    if (!user) clearTickets();
  }, [user, clearTickets]);

  // Refetch tickets when project changes (with loading state)
  useEffect(() => {
    if (currentProject) {
      resetAndFetch();
    }
  }, [currentProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Emit socket join/leave on project switch
  const prevProjectRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevProjectRef.current && prevProjectRef.current !== currentProject?.id) {
      emit('project:leave', prevProjectRef.current);
    }
    if (currentProject?.id) {
      emit('project:join', currentProject.id);
    }
    prevProjectRef.current = currentProject?.id ?? null;
  }, [currentProject?.id, emit]);

  useEffect(() => {
    on('notification', (data: { message: string; type: 'success' | 'warning' | 'error' | 'info' }) => {
      addNotification(data.message, data.type);
    });

    on('ticket:status', (data: { ticketId: number; status: string; progress: number }) => {
      updateTicketInState(data.ticketId, { status: data.status, progress: data.progress });
      setSelectedTicket(prev => prev && prev.id === data.ticketId ? { ...prev, status: data.status, progress: data.progress } : prev);
    });

    on('ticket:updated', () => {
      fetchTickets();
    });

    return () => {
      off('notification');
      off('ticket:status');
      off('ticket:updated');
    };
  }, [on, off, addNotification, updateTicketInState, fetchTickets]);

  // Ctrl+K handler
  const handleCmdK = useCallback(() => setShowCmd(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmd(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredTickets = tickets.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || `#${t.id}`.includes(q);
  });

  const handleTicketClick = (ticket: Ticket) => setSelectedTicket(ticket);

  // Handle ?checkout=success on dashboard mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      addNotification(t.billingCheckoutSuccess, 'success');
      refreshSession().catch(() => {});
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [addNotification, t.billingCheckoutSuccess, refreshSession]);

  const handleLaunch = async (id: number) => {
    if (!user || user.isVisitor) { openLogin(); return; }
    try {
      // Check if project is configured
      const status = await getSetupStatus();
      if (!status.repoConfigured) {
        setShowSetupModal(true);
        setPendingLaunchId(id);
        return;
      }

      await launch(id);
      addNotification(`${t.pipelineLaunched} #${id}`, 'info');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('project_not_configured')) {
        setShowSetupModal(true);
        setPendingLaunchId(id);
      } else if (msg.includes('plan_limit')) {
        addNotification(`${t.billingPlanLimitPipelines} ${t.billingUpgradePrompt}`, 'warning');
      } else {
        addNotification(`${t.error}: ${msg}`, 'error');
      }
    }
  };

  // --- Onboarding: create demo ticket (local only, no API) ---
  const handleCreateDemoTicket = async (): Promise<number> => {
    const demoId = 1;
    const now = new Date().toISOString();
    demoTicketIdRef.current = demoId;
    insertLocalTicket({
      id: demoId,
      title: t.onboardDemoTitle,
      description: t.onboardDemoDesc,
      status: 'backlog',
      priority: 'medium',
      template: 'feature',
      ai_model: 'claude',
      repo: 'main-site',
      assignee: 'unassigned',
      progress: 0,
      cost_usd: 0,
      tokens_used: 0,
      lines_added: 0,
      lines_removed: 0,
      ai_review_score: null,
      ai_review_data: null,
      test_results: null,
      target_files: '[]',
      tags: '[]',
      depends_on: '[]',
      complexity: '',
      position: 0,
      due_date: null,
      branch_name: '',
      diff: '',
      creator_email: null,
      modifier_email: null,
      created_at: now,
      updated_at: now,
    });
    return demoId;
  };

  // --- Onboarding: simulate pipeline visually through all 10 columns (no API) ---
  const handleSimulatePipeline = (ticketId: number, onStep: (status: string) => void, onComplete: () => void) => {
    const FLY_DURATION = 550; // ghost fly animation time
    const PIPELINE_STEPS: { status: string; progress: number; delay: number; fields?: Partial<Ticket> }[] = [
      { status: 'queued',     progress: 5,   delay: 1200 },
      { status: 'estimating', progress: 15,  delay: 1800,  fields: { cost_usd: 2.45 } },
      { status: 'ai_coding',  progress: 35,  delay: 2200, fields: { lines_added: 234 } },
      { status: 'ai_coding',  progress: 55,  delay: 2200, fields: { lines_added: 534 } },
      { status: 'ai_review',  progress: 70,  delay: 1800,  fields: { ai_review_score: 92 } },
      { status: 'testing',    progress: 80,  delay: 1200 },
      { status: 'deploying',  progress: 88,  delay: 1200 },
      { status: 'staging',    progress: 94,  delay: 1200 },
      { status: 'review',     progress: 97,  delay: 1200 },
      { status: 'approved',   progress: 100, delay: 4000 },
    ];

    let totalDelay = 0;
    for (const step of PIPELINE_STEPS) {
      totalDelay += step.delay;
      const t = totalDelay;
      // Notify onboarding first (triggers ghost fly animation)
      setTimeout(() => { onStep(step.status); }, t);
      // Update ticket state after ghost animation lands
      setTimeout(() => {
        updateTicketInState(ticketId, { status: step.status, progress: step.progress, ...step.fields });
      }, t + FLY_DURATION);
    }

    // Notify onboarding when simulation is done (ticket stays in approved until user closes tutorial)
    setTimeout(() => {
      onComplete();
    }, totalDelay + FLY_DURATION + 4000);
  };

  const handleSetupComplete = async () => {
    setShowSetupModal(false);
    if (pendingLaunchId) {
      try {
        await launch(pendingLaunchId);
        addNotification(`${t.pipelineLaunched} #${pendingLaunchId}`, 'info');
      } catch (err) {
        addNotification(`${t.error}: ${(err as Error).message}`, 'error');
      }
      setPendingLaunchId(null);
    }
  };

  return (
    <div className={`h-screen text-tx-primary overflow-hidden flex flex-col bg-animated relative ${aiDesign ? 'ai-dot-grid' : ''} animate-[dashboardIn_0.6s_ease-out]`} style={{ background: 'var(--bg-gradient)' }}>
      <Header
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        tickets={tickets}
        showMascot={showMascot}
        onToggleMascot={toggleMascot}
        onCmdK={handleCmdK}
        onCreateProject={() => setShowCreateProject(true)}
        onOpenProjectSettings={() => setShowProjectSettings(true)}
        onOpenInvitations={() => setShowInvitations(true)}
        presenceUsers={presence}
        onNotificationTicketClick={(ticketId: number, tab?: string) => {
          const ticket = tickets.find(t => t.id === ticketId);
          if (ticket) {
            setSelectedTicketTab(tab);
            setSelectedTicket(ticket);
          }
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <FileLockBanner />
        {viewMode === 'calendar' ? (
          <CalendarView tickets={filteredTickets} onTicketClick={handleTicketClick} />
        ) : viewMode === 'timeline' ? (
          <TimelineView tickets={filteredTickets} onTicketClick={handleTicketClick} />
        ) : viewMode === 'board' ? (
          <KanbanBoard tickets={filteredTickets} onTicketClick={handleTicketClick} onLaunch={handleLaunch} onCreateClick={() => { if (!user || user.isVisitor) { openLogin(); return; } setShowCreate(true); }} onReorder={reorder} hideEmptyCTA={showOnboarding} />
        ) : (
          <ListView tickets={filteredTickets} onTicketClick={handleTicketClick} scoreThresholdGood={appConfig.score_threshold_good} scoreThresholdOk={appConfig.score_threshold_ok} />
        )}
      </div>

      {/* Live cursors overlay */}
      <LiveCursors cursors={cursors} sendCursorMove={sendCursorMove} sendCursorLeave={sendCursorLeave} />

      {/* Live activity bar */}
      {aiDesign && <LiveActivityBar tickets={tickets} />}

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreate={create}
        />
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          initialTab={selectedTicketTab}
          onClose={() => { setSelectedTicket(null); setSelectedTicketTab(undefined); }}
          onApprove={async (id: number) => { await approve(id); setSelectedTicket(null); }}
          onReject={async (id: number) => { await reject(id); setSelectedTicket(null); }}
          onRetry={async (id: number) => { await retry(id); setSelectedTicket(null); }}
          onRollback={async (id: number) => { await rollback(id); setSelectedTicket(null); }}
          onDelete={async (id: number) => { await remove(id); setSelectedTicket(null); }}
        />
      )}

      {/* Command palette */}
      {showCmd && aiDesign && (
        <CommandPalette
          tickets={tickets}
          onSelect={handleTicketClick}
          onClose={() => setShowCmd(false)}
          onCreate={() => { if (!user || user.isVisitor) { openLogin(); return; } setShowCreate(true); }}
        />
      )}

      <NotificationToast notifications={notifications} onRemove={removeNotification} />

      {/* Project modals */}
      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}
      {showProjectSettings && <ProjectSettingsModal onClose={() => setShowProjectSettings(false)} />}
      {showInvitations && <InvitationsModal onClose={() => setShowInvitations(false)} />}
      {showSetupModal && <ProjectSetupModal onClose={() => { setShowSetupModal(false); setPendingLaunchId(null); }} onComplete={handleSetupComplete} />}

      {/* Crab mascot */}
      {showMascot && <CrabMascot tickets={tickets} />}

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding
          onDone={() => {
            setShowOnboarding(false);
            localStorage.setItem('crab-onboarded', 'true');
            if (demoTicketIdRef.current) {
              removeLocalTicket(demoTicketIdRef.current);
              demoTicketIdRef.current = null;
            }
          }}
          onCreateDemoTicket={handleCreateDemoTicket}
          onSimulatePipeline={handleSimulatePipeline}
        />
      )}
    </div>
  );
}

/** Dashboard with login modal overlay when not authenticated */
function DashboardWithAuth() {
  const { user, loading } = useAuth();
  const { showLogin, closeLogin } = useLoginModal();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const handleClose = () => {
    setDismissed(true);
    closeLogin();
  };

  // Close login modal when user changes (e.g. visitor clicks "Nouveau client")
  const prevUserIdRef = useRef(user?.id);
  useEffect(() => {
    if (user && user.id !== prevUserIdRef.current) {
      closeLogin();
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id, closeLogin]);

  // Show modal: on first load if not auth'd (until dismissed), or when triggered by action (including visitors)
  const showModal = (!user && (showLogin || !dismissed)) || (user?.isVisitor && showLogin);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-5xl mb-4 animate-bounce">🦀</div>
        <p className="text-tx-faint text-sm">{t.authLoading}</p>
      </div>
    );
  }

  return (
    <>
      <Dashboard />
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <LoginPage onClose={handleClose} />
          </div>
        </>
      )}
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
      <Route path="/pricing" element={<PublicLayout><PricingPage /></PublicLayout>} />
      <Route path="/contact" element={<PublicLayout><ContactPage /></PublicLayout>} />
      <Route path="/legal" element={<PublicLayout><LegalPage /></PublicLayout>} />
      <Route path="/privacy" element={<PublicLayout><PrivacyPage /></PublicLayout>} />
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardWithAuth />} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AnimationsProvider>
        <AIDesignProvider>
          <LanguageProvider>
            <AuthProvider>
              <LoginModalProvider>
                <ProjectProvider>
                  <AppRoutes />
                </ProjectProvider>
              </LoginModalProvider>
            </AuthProvider>
          </LanguageProvider>
        </AIDesignProvider>
      </AnimationsProvider>
    </ThemeProvider>
  );
}
