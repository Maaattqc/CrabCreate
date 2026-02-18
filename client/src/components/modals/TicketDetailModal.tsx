import { useState, useRef, useEffect } from 'react';
import { X, RotateCcw, Undo2, Trash2, Activity, ShieldCheck, MessageSquare, Terminal, Code2, FlaskConical, User, Calendar, Eye, EyeOff, Users, Lock, CheckSquare, Clock, ExternalLink } from 'lucide-react';
import { getColumnColor, getColumnLabel } from '../../constants';
import { updateTicket, getTicketColumnTimes } from '../../api/tickets';
import { fetchWatchers, toggleWatch } from '../../api/comments';
import { useLanguage } from '../../hooks/useLanguage';
import { useEditingLock, useTicketViewers } from '../../hooks/useCollaboration';
import { useSocket } from '../../hooks/useSocket';
import { useProject } from '../../hooks/useProject';
import { useAuth } from '../../hooks/useAuth';
import { userColor } from '../../hooks/useCursors';
import TerminalLogs from '../detail-tabs/TerminalLogs';
import DiffViewer from '../detail-tabs/DiffViewer';
import AIReviewTab from '../detail-tabs/AIReviewTab';
import TestsTab from '../detail-tabs/TestsTab';
import ChatTab from '../detail-tabs/ChatTab';
import ActivityTab from '../detail-tabs/ActivityTab';
import CommentsTab from '../detail-tabs/CommentsTab';
import SubtasksTab from './SubtasksTab';
import type { Ticket, ColumnTime } from '../../types';

interface TicketDetailModalProps {
  ticket: Ticket;
  initialTab?: string;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onRetry: (id: number) => void;
  onRollback: (id: number) => void;
  onDelete: (id: number) => void;
  onReview?: (ticket: Ticket) => void;
}

export default function TicketDetailModal({ ticket, initialTab, onClose, onApprove, onReject, onRetry, onRollback, onDelete, onReview }: TicketDetailModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { on, off } = useSocket();
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState(initialTab || 'activity');
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchersCount, setWatchersCount] = useState(0);
  const [dueDate, setDueDate] = useState(ticket.due_date || '');
  const [showDueDateInput, setShowDueDateInput] = useState(false);
  const [columnTimes, setColumnTimes] = useState<ColumnTime[]>([]);
  const productionUrl = currentProject?.cf_site_url || null;
  const titleRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const { isFieldLocked, startEditing, stopEditing } = useEditingLock(ticket.id);
  const { getViewers, startViewing, stopViewing } = useTicketViewers();
  const viewers = getViewers(ticket.id);
  const statusColor = getColumnColor(ticket.status);
  const statusLabel = getColumnLabel(ticket.status, t as unknown as Record<string, string>);
  const isActive = ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying'].includes(ticket.status);
  const titleLock = isFieldLocked('title');
  const descLock = isFieldLocked('description');

  const username = (email: string | null) => email ? email.split('@')[0] : null;
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  };

  const TABS = [
    { id: 'activity', label: t.tabActivity, icon: Activity },
    { id: 'comments', label: t.tabComments, icon: Users },
    { id: 'review', label: t.tabQuality, icon: ShieldCheck },
    { id: 'chat', label: t.tabChat, icon: MessageSquare },
    { id: 'terminal', label: t.tabLogs, icon: Terminal },
    { id: 'diff', label: t.tabCode, icon: Code2 },
    { id: 'tests', label: t.tabTests, icon: FlaskConical },
    { id: 'subtasks', label: t.subtasks, icon: CheckSquare },
  ];

  // Start viewing on mount, stop on unmount
  useEffect(() => {
    startViewing(ticket.id);
    fetchWatchers(ticket.id).then(data => {
      setWatching(data.isWatching);
      setWatchersCount(data.watchers.length);
    }).catch(() => {});
    getTicketColumnTimes(ticket.id).then(setColumnTimes).catch(() => {});
    return () => { stopViewing(ticket.id); stopEditing(); };
  }, [ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time sync: update title/description when another user edits them
  useEffect(() => {
    const handler = (data: { ticketId: number; title?: string; description?: string }) => {
      if (data.ticketId !== ticket.id) return;
      // Only update if not currently focused (editing) by this user
      if (data.title !== undefined && document.activeElement !== titleRef.current) {
        setTitle(data.title);
        ticket.title = data.title;
      }
      if (data.description !== undefined && document.activeElement !== descRef.current) {
        setDescription(data.description);
        ticket.description = data.description;
      }
    };
    on('ticket:updated', handler);
    return () => { off('ticket:updated'); };
  }, [on, off, ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Due date helpers
  const todayStr = new Date().toISOString().split('T')[0];
  const isDueDateOverdue = dueDate && dueDate < todayStr;
  const isDueDateToday = dueDate && dueDate === todayStr;

  const saveDueDate = async (value: string | null) => {
    try {
      await updateTicket(ticket.id, { due_date: value } as Partial<Ticket>);
      ticket.due_date = value;
      setDueDate(value || '');
      setShowDueDateInput(false);
    } catch { /* ignore */ }
  };

  const handleToggleWatch = async () => {
    try {
      const result = await toggleWatch(ticket.id);
      setWatching(result.watching);
      setWatchersCount(prev => result.watching ? prev + 1 : Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (descRef.current) {
      descRef.current.style.height = 'auto';
      descRef.current.style.height = descRef.current.scrollHeight + 'px';
    }
  }, [description]);

  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleFieldFocus = (field: string) => startEditing(field);
  const handleFieldBlur = (field: string) => stopEditing(field);

  const saveField = async (field: 'title' | 'description', value: string) => {
    if (field === 'title' && value.trim().length < 3) {
      setTitle(ticket.title);
      if (value.trim().length > 0) setFieldError(t.validationTitleHint);
      return;
    }
    if (value === (field === 'title' ? ticket.title : ticket.description || '')) return;
    setSaving(true);
    setFieldError(null);
    try {
      await updateTicket(ticket.id, { [field]: value.trim() });
      if (field === 'title') ticket.title = value.trim();
      else ticket.description = value.trim();
    } catch (err) {
      setFieldError((err as Error).message);
      if (field === 'title') setTitle(ticket.title);
      else setDescription(ticket.description || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface border border-th-border-strong rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col shadow-2xl shadow-black/40 transition-all duration-300"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-tx-faint bg-subtle px-2 py-1 rounded">#{ticket.id}</span>
              <span
                className="text-xs px-3 py-1 rounded-full font-semibold tracking-wide uppercase"
                style={{ backgroundColor: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}30` }}
              >
                {statusLabel}
              </span>
              {isActive && ticket.progress > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ticket.progress}%`, backgroundColor: statusColor }} />
                  </div>
                  <span className="text-[10px] font-mono text-tx-faint">{ticket.progress}%</span>
                </div>
              )}
            </div>
            {/* Viewers */}
            {viewers.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                {viewers.slice(0, 3).map(v => (
                  <div
                    key={v.userId}
                    className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: userColor(v.userId) }}
                    title={`${v.email} ${t.viewingTicket}`}
                  >
                    {v.email[0]?.toUpperCase()}
                  </div>
                ))}
                {viewers.length > 3 && <span className="text-[10px] text-tx-faint">+{viewers.length - 3}</span>}
              </div>
            )}
            {/* Watch button */}
            <button
              onClick={handleToggleWatch}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors mr-1 ${
                watching ? 'bg-amber-500/15 text-amber-400' : 'text-tx-faint hover:text-tx-tertiary hover:bg-subtle-hover'
              }`}
              title={watching ? t.unwatchTicket : t.watchTicket}
            >
              {watching ? <Eye size={13} /> : <EyeOff size={13} />}
              {watchersCount > 0 && <span>{watchersCount}</span>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Per-field lock banners */}
          {(titleLock || descLock) && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {titleLock && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Lock size={11} className="text-amber-400" />
                  <span className="text-[10px] text-amber-400">{titleLock.email.split('@')[0]} {t.commentsEditingLock} ({t.titleFieldLabel})</span>
                </div>
              )}
              {descLock && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Lock size={11} className="text-amber-400" />
                  <span className="text-[10px] text-amber-400">{descLock.email.split('@')[0]} {t.commentsEditingLock} ({t.descFieldLabel})</span>
                </div>
              )}
            </div>
          )}

          {/* Editable title — click to edit */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-tx-faint font-medium uppercase tracking-wide shrink-0 flex items-center gap-1">
              {t.titleFieldLabel}
              {titleLock && <Lock size={10} className="text-amber-400" />}
            </span>
            <input
              ref={titleRef}
              value={title}
              onChange={e => { setTitle(e.target.value); setFieldError(null); }}
              onFocus={() => handleFieldFocus('title')}
              onBlur={() => { saveField('title', title); handleFieldBlur('title'); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur(); } }}
              className={`w-full text-xl font-bold text-tx-primary bg-transparent border-0 border-b border-transparent hover:border-th-border focus:border-amber-500/50 focus:outline-none px-0 py-1 transition-colors placeholder-tx-ghost ${titleLock ? 'opacity-60 pointer-events-none' : ''}`}
              placeholder={t.titleFieldPlaceholder}
              maxLength={200}
              disabled={!!titleLock}
            />
          </div>

          {/* Editable description — click to edit */}
          <div className="mt-3">
            <span className="text-xs text-tx-faint font-medium uppercase tracking-wide flex items-center gap-1">
              {t.descFieldLabel}
              {descLock && <Lock size={10} className="text-amber-400" />}
            </span>
            <textarea
              ref={descRef}
              value={description}
              onChange={e => setDescription(e.target.value)}
              onFocus={() => handleFieldFocus('description')}
              onBlur={() => { saveField('description', description); handleFieldBlur('description'); }}
              className={`w-full text-sm text-tx-tertiary bg-subtle border border-th-border hover:border-th-border-strong focus:border-amber-500/50 focus:outline-none rounded-lg px-3 py-3 mt-1.5 resize-none leading-relaxed transition-colors placeholder-tx-ghost overflow-hidden min-h-[80px] ${descLock ? 'opacity-60 pointer-events-none' : ''}`}
              placeholder={t.descFieldPlaceholder}
              rows={3}
              maxLength={5000}
              disabled={!!descLock}
            />
          </div>

          <div className="flex items-center gap-3">
            {saving && <span className="text-[10px] text-amber-400 font-mono">{t.saving}</span>}
            {fieldError && <span className="text-[10px] text-red-400">{fieldError}</span>}
          </div>

          {/* Meta info pills */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select
              value={ticket.ai_model}
              onChange={async (e) => {
                const newModel = e.target.value;
                try {
                  await updateTicket(ticket.id, { ai_model: newModel } as Partial<Ticket>);
                  ticket.ai_model = newModel;
                } catch { /* ignore */ }
              }}
              className="text-[11px] text-tx-faint bg-subtle px-2.5 py-1 rounded-md border-none outline-none cursor-pointer hover:bg-subtle-hover transition-colors"
            >
              <option value="claude">🟣 Claude</option>
              <option value="gpt">🟢 GPT</option>
            </select>
            {ticket.ai_review_score != null && (
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md ${
                ticket.ai_review_score >= 70 ? 'bg-green-500/10 text-green-400' :
                ticket.ai_review_score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {t.score} {ticket.ai_review_score}/100
              </span>
            )}
            {ticket.cost_usd > 0 && (
              <span className="text-[11px] text-tx-faint bg-subtle px-2.5 py-1 rounded-md font-mono">
                {ticket.cost_usd.toFixed(4)}$
              </span>
            )}
            {ticket.tokens_used > 0 && (
              <span className="text-[11px] text-tx-faint bg-subtle px-2.5 py-1 rounded-md font-mono">
                {ticket.tokens_used.toLocaleString()} tokens
              </span>
            )}
            {ticket.lines_added > 0 && (
              <span className="text-[11px] bg-subtle px-2.5 py-1 rounded-md">
                <span className="text-green-400">+{ticket.lines_added}</span>
                <span className="text-tx-ghost mx-1">/</span>
                <span className="text-red-400">-{ticket.lines_removed}</span>
              </span>
            )}
            {ticket.pipeline_step > 0 && isActive && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400">
                {t.pipelineStep} {ticket.pipeline_step}/7
              </span>
            )}
            {/* Due date pill */}
            {dueDate ? (
              <span
                className={`relative text-[11px] font-medium px-2.5 py-1 rounded-md cursor-pointer flex items-center gap-1.5 ${
                  isDueDateOverdue ? 'bg-red-500/10 text-red-400' :
                  isDueDateToday ? 'bg-amber-500/10 text-amber-400' :
                  'bg-subtle text-tx-faint'
                }`}
                onClick={() => setShowDueDateInput(true)}
              >
                <Clock size={11} />
                {isDueDateOverdue && t.dueDateOverdue + ' — '}
                {isDueDateToday && t.dueDateToday + ' — '}
                {new Date(dueDate + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                <button
                  onClick={(e) => { e.stopPropagation(); saveDueDate(null); }}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                  title={t.dueDateClear}
                >
                  <X size={10} />
                </button>
              </span>
            ) : (
              <button
                onClick={() => setShowDueDateInput(true)}
                className="text-[11px] text-tx-faint bg-subtle px-2.5 py-1 rounded-md hover:text-tx-tertiary hover:bg-subtle-hover transition-colors flex items-center gap-1.5"
              >
                <Clock size={11} />
                {t.dueDateSet}
              </button>
            )}
            {showDueDateInput && (
              <input
                ref={dueDateRef}
                type="date"
                value={dueDate}
                autoFocus
                onChange={(e) => saveDueDate(e.target.value || null)}
                onBlur={() => setShowDueDateInput(false)}
                className="text-[11px] bg-card border border-th-border-strong rounded-md px-2 py-1 text-tx-secondary focus:outline-none focus:border-amber-500/50"
              />
            )}
          </div>

          {/* Column times */}
          {columnTimes.length > 0 && (
            <div className="mt-3">
              <span className="text-[10px] text-tx-faint font-medium uppercase tracking-wide">{t.columnTimesTitle}</span>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {columnTimes.map(ct => {
                  const color = getColumnColor(ct.status);
                  return (
                    <span
                      key={ct.status}
                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-subtle"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-tx-faint">{getColumnLabel(ct.status, t as unknown as Record<string, string>)}</span>
                      <span className="font-mono font-medium text-tx-tertiary">{formatDuration(ct.duration_seconds)}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Creator / modifier info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-tx-faint">
            {username(ticket.creator_email) && (
              <span className="flex items-center gap-1">
                <User size={11} className="text-tx-ghost" />
                {t.ticketCreatedBy} <span className="text-tx-tertiary font-medium">{username(ticket.creator_email)}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar size={11} className="text-tx-ghost" />
              {t.ticketCreatedAt} <span className="text-tx-tertiary">{formatDate(ticket.created_at)}</span>
            </span>
            {username(ticket.modifier_email) && (
              <span className="flex items-center gap-1">
                <User size={11} className="text-tx-ghost" />
                {t.ticketModifiedBy} <span className="text-tx-tertiary font-medium">{username(ticket.modifier_email)}</span>
              </span>
            )}
            {ticket.updated_at && ticket.updated_at !== ticket.created_at && (
              <span className="flex items-center gap-1">
                <Calendar size={11} className="text-tx-ghost" />
                {t.ticketUpdatedAt} <span className="text-tx-tertiary">{formatDate(ticket.updated_at)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-8 border-b border-th-border">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative rounded-t-lg ${
                  active
                    ? 'text-amber-400 bg-subtle/50'
                    : 'text-tx-faint hover:text-tx-tertiary hover:bg-subtle/30'
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {active && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-amber-400 rounded-t" />}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {activeTab === 'activity' && <ActivityTab ticketId={ticket.id} />}
          {activeTab === 'comments' && <CommentsTab ticketId={ticket.id} />}
          {activeTab === 'review' && <AIReviewTab ticket={ticket} />}
          {activeTab === 'chat' && <ChatTab ticketId={ticket.id} />}
          {activeTab === 'terminal' && <TerminalLogs ticketId={ticket.id} />}
          {activeTab === 'diff' && <DiffViewer ticketId={ticket.id} />}
          {activeTab === 'tests' && <TestsTab ticket={ticket} />}
          {activeTab === 'subtasks' && <SubtasksTab ticketId={ticket.id} />}
        </div>

        {/* Actions */}
        <div className="px-8 py-4 border-t border-th-border flex items-center gap-3">
          {ticket.status === 'review' && onReview && (
            <button
              onClick={() => { onClose(); onReview(ticket); }}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/20 hover:shadow-violet-500/30 transition-all"
            >
              {t.viewChanges}
            </button>
          )}
          {ticket.status === 'rejected' && (
            <button onClick={() => onRetry(ticket.id)} className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-500/25 border border-blue-500/20 transition-all">
              <RotateCcw size={14} /> {t.retry}
            </button>
          )}
          {ticket.status === 'approved' && (
            <>
              {ticket.staging_url && ticket.staging_url !== '#simulation' && (
                <a href={ticket.staging_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-500/25 border border-blue-500/20 transition-all">
                  <ExternalLink size={14} /> {t.viewSite}
                </a>
              )}
              <button onClick={() => onRollback(ticket.id)} className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 text-amber-400 text-sm font-medium rounded-lg hover:bg-amber-500/25 border border-amber-500/20 transition-all">
                <Undo2 size={14} /> {t.rollback}
              </button>
            </>
          )}
          <div className="flex-1" />
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 text-tx-faint hover:text-red-400 hover:bg-red-500/10 text-sm rounded-lg transition-all"
            >
              <Trash2 size={14} /> {t.delete}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              <div className="text-xs text-red-400 mr-2">
                <div className="font-semibold">{t.confirmDeleteTitle}</div>
                <div className="text-red-400/70 text-[10px]">{t.confirmDeleteMsg}</div>
              </div>
              <button
                onClick={() => { onDelete(ticket.id); onClose(); }}
                className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-md hover:bg-red-600 transition-colors"
              >
                {t.confirmYes}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-tx-faint text-xs hover:text-tx-tertiary transition-colors"
              >
                {t.confirmNo}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
