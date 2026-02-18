import { Play, Settings, Move, Star, Archive } from 'lucide-react';
import { getColumnColor } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import { useAIDesign } from '../../hooks/useAIDesign';
import { userColor } from '../../hooks/useCursors';
import LabelBadge from './LabelBadge';
import type { Ticket, TicketViewer, Label } from '../../types';

interface TicketCardProps {
  ticket: Ticket;
  onClick: (t: Ticket) => void;
  onLaunch: (id: number) => void;
  onArchive?: (id: number) => void;
  onReview?: (ticket: Ticket) => void;
  viewers?: TicketViewer[];
  draggingBy?: { userId: number; email: string } | null;
  labels?: Label[];
  isFavorite?: boolean;
}

/* Mini sparkline SVG from ticket numeric data */
function Sparkline({ color, progress }: { color: string; progress: number }) {
  // Generate a simple synthetic sparkline based on progress
  const points = [0, 12, 8, 25, 18, 40, 35, progress, Math.min(progress + 10, 100)];
  const w = 48, h = 16;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - (p / 100) * h;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={path} className="ai-sparkline" stroke={color} strokeOpacity={0.6} />
    </svg>
  );
}

export default function TicketCard({ ticket, onClick, onLaunch, onArchive, onReview, viewers = [], draggingBy, labels = [], isFavorite = false }: TicketCardProps) {
  const { t } = useLanguage();
  const { aiDesign } = useAIDesign();
  const statusColor = getColumnColor(ticket.status);
  const canLaunch = ticket.status === 'backlog';
  const isActive = ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying'].includes(ticket.status);

  const rawTags = (ticket.tags || '').replace(/^\[|\]$/g, '').replace(/^"(.*)"$/, '$1');
  const tags = rawTags ? rawTags.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean) : [];

  // Due date logic
  const today = new Date().toISOString().split('T')[0];
  const hasDueDate = !!ticket.due_date;
  const isOverdue = hasDueDate && ticket.due_date! < today;
  const isToday = hasDueDate && ticket.due_date === today;
  const dueDateFormatted = hasDueDate
    ? new Date(ticket.due_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;

  return (
    <div
      onClick={() => onClick(ticket)}
      className={`group bg-card border border-th-border rounded-xl p-3.5 cursor-pointer hover:border-th-border-strong hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all relative overflow-hidden anim-card anim-card-border animate-[cardSlideIn_0.4s_ease-out] ${aiDesign ? 'ai-glass' : ''} ${isActive && aiDesign ? 'ai-neon-active' : ''}`}
      style={isActive && aiDesign ? { '--neon-color': `${statusColor}30` } as React.CSSProperties : undefined}
    >
      {/* Left color accent */}
      <div
        className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full"
        style={{ backgroundColor: statusColor }}
      />

      {/* Top right: due date badge + favorite star */}
      <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
        {isFavorite && (
          <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />
        )}
        {hasDueDate && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isOverdue ? 'bg-red-500/15 text-red-400' :
            isToday ? 'bg-amber-500/15 text-amber-400' :
            'bg-subtle text-tx-faint'
          }`}>
            {dueDateFormatted}
          </span>
        )}
      </div>

      {/* Drag awareness overlay */}
      {draggingBy && (
        <div className="absolute inset-0 bg-amber-500/5 border-2 border-amber-500/30 border-dashed rounded-xl z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 bg-surface/90 rounded-md max-w-[90%]">
            <Move size={12} className="text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium truncate max-w-full">{draggingBy.email.split('@')[0]}</span>
            <span className="text-[9px] text-amber-400/70">{t.draggingTicket}</span>
          </div>
        </div>
      )}

      <div className="pl-2.5">
        {/* Viewing avatars */}
        {viewers.length > 0 && (
          <div className="flex items-center gap-0.5 mb-1.5">
            {viewers.slice(0, 3).map(v => (
              <div
                key={v.userId}
                className="w-4.5 h-4.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: userColor(v.userId) }}
                title={`${v.email} ${t.viewingTicket}`}
              >
                {v.email[0]?.toUpperCase()}
              </div>
            ))}
            {viewers.length > 3 && <span className="text-[9px] text-tx-ghost ml-0.5">+{viewers.length - 3}</span>}
          </div>
        )}

        {/* Title */}
        <h4 className="text-[15px] text-tx-primary font-semibold leading-snug mb-1.5 line-clamp-2">{ticket.title}</h4>

        {/* Tags */}
        {aiDesign && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/10">{tag}</span>
            ))}
          </div>
        )}

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {labels.slice(0, 3).map(label => (
              <LabelBadge key={label.id} label={label} size="sm" />
            ))}
            {labels.length > 3 && (
              <span className="text-[10px] text-tx-faint font-medium">+{labels.length - 3}</span>
            )}
          </div>
        )}

        {/* Progress bar for active tickets */}
        {isActive && ticket.progress > 0 && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex-1 h-1.5 bg-subtle rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out anim-progress"
                style={{
                  width: `${ticket.progress}%`,
                  background: `linear-gradient(to right, ${statusColor}, ${statusColor}cc)`,
                }}
              />
            </div>
            {/* Sparkline next to progress */}
            {aiDesign && <Sparkline color={statusColor} progress={ticket.progress} />}
          </div>
        )}

        {/* Cost & lines stats for active/completed pipeline tickets */}
        {(ticket.cost_usd > 0 || ticket.lines_added > 0) && (
          <div className="flex items-center gap-3 mb-2 text-[11px] font-mono text-tx-faint">
            {ticket.cost_usd > 0 && (
              <span className="flex items-center gap-1">
                {ticket.cost_usd.toFixed(2)}<span className="text-amber-400">$</span>
              </span>
            )}
            {ticket.lines_added > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-green-400">+</span>{ticket.lines_added} {t.lines.toLowerCase()}
              </span>
            )}
          </div>
        )}

        {/* View changes button for review status */}
        {ticket.status === 'review' && (
          <div className="mb-2.5">
            <button
              data-onboard-approve-btn
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onReview?.(ticket); }}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold transition-all hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/20 hover:shadow-violet-500/30"
            >
              {t.viewChanges}
            </button>
          </div>
        )}

        {/* Archive button for approved tickets */}
        {ticket.status === 'approved' && onArchive && (
          <div className="mb-2.5">
            <button
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onArchive(ticket.id); }}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-semibold transition-colors hover:bg-slate-500/20"
            >
              <Archive size={12} />
              {t.archive}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center">
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClick(ticket); }}
            className="p-1.5 rounded-md hover:bg-subtle-hover text-tx-faint hover:text-tx-tertiary transition-all"
            title={t.editTicket}
          >
            <Settings size={15} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-sm font-mono text-tx-muted">#{ticket.id}</span>
            {ticket.ai_review_score != null && (
              <span className={`text-sm font-mono font-semibold px-2 py-0.5 rounded-md ${
                ticket.ai_review_score >= 70 ? 'text-green-400 bg-green-500/15' :
                ticket.ai_review_score >= 50 ? 'text-amber-400 bg-amber-500/15' :
                'text-red-400 bg-red-500/15'
              }`}>
                {ticket.ai_review_score}
              </span>
            )}
          </div>
          {canLaunch ? (
            <button
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onLaunch(ticket.id); }}
              className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/25 text-green-400 transition-all"
              title={t.launchPipeline}
              data-onboard="launch-pipeline"
            >
              <Play size={14} fill="currentColor" />
            </button>
          ) : (
            <div className="w-[34px]" />
          )}
        </div>
      </div>
    </div>
  );
}
