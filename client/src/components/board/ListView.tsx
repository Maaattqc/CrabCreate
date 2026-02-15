import { useState } from 'react';
import { getColumnColor, COLUMNS } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import type { Ticket } from '../../types';

type ListFilter = 'all' | 'active' | 'completed';

const COMPLETED_STATUSES = ['approved', 'rejected'];

interface ListViewProps {
  tickets: Ticket[];
  onTicketClick: (t: Ticket) => void;
  scoreThresholdGood?: number;
  scoreThresholdOk?: number;
}

function formatDueDate(dateStr: string | null): { text: string; className: string } {
  if (!dateStr) return { text: '', className: '' };
  const due = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const formatted = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (dueDay < today) {
    return { text: formatted, className: 'text-red-400 font-medium' };
  }
  if (dueDay.getTime() === today.getTime()) {
    return { text: formatted, className: 'text-amber-400 font-medium' };
  }
  return { text: formatted, className: 'text-tx-faint' };
}

export default function ListView({ tickets, onTicketClick, scoreThresholdGood = 70, scoreThresholdOk = 50 }: ListViewProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ListFilter>('all');

  const filters: { key: ListFilter; label: string }[] = [
    { key: 'all', label: t.historyAll },
    { key: 'active', label: t.historyActive },
    { key: 'completed', label: t.historyCompleted },
  ];

  const filtered = tickets.filter(tk => {
    if (filter === 'completed') return COMPLETED_STATUSES.includes(tk.status);
    if (filter === 'active') return !COMPLETED_STATUSES.includes(tk.status);
    return true;
  });

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-subtle text-tx-faint hover:text-tx-tertiary hover:bg-subtle-hover'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-xs text-tx-faint uppercase tracking-wider border-b border-th-border">
            <th className="text-left py-2 px-3 font-medium">#</th>
            <th className="text-left py-2 px-3 font-medium">Titre</th>
            <th className="text-left py-2 px-3 font-medium">Statut</th>
            <th className="text-left py-2 px-3 font-medium">AI</th>
            <th className="text-left py-2 px-3 font-medium">Score</th>
            <th className="text-left py-2 px-3 font-medium">{t.dueDate}</th>
            <th className="text-left py-2 px-3 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(ticket => {
            const statusColor = getColumnColor(ticket.status);
            const statusLabel = COLUMNS.find(c => c.id === ticket.status)?.label || ticket.status;
            return (
              <tr
                key={ticket.id}
                onClick={() => onTicketClick(ticket)}
                className="border-b border-th-border hover:bg-subtle cursor-pointer transition-colors"
              >
                <td className="py-2.5 px-3 text-xs font-mono text-tx-faint">#{ticket.id}</td>
                <td className="py-2.5 px-3 text-sm text-tx-secondary max-w-xs truncate">{ticket.title}</td>
                <td className="py-2.5 px-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: statusColor + '20', color: statusColor }}>
                    {statusLabel}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-xs font-mono text-tx-muted">{ticket.ai_model}</td>
                <td className="py-2.5 px-3">
                  {ticket.ai_review_score != null && (
                    <span className={`text-xs font-mono ${ticket.ai_review_score >= scoreThresholdGood ? 'text-green-400' : ticket.ai_review_score >= scoreThresholdOk ? 'text-amber-400' : 'text-red-400'}`}>
                      {ticket.ai_review_score}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {(() => {
                    const { text, className } = formatDueDate(ticket.due_date);
                    return text ? <span className={`text-xs ${className}`}>{text}</span> : null;
                  })()}
                </td>
                <td className="py-2.5 px-3">
                  {ticket.progress > 0 && (
                    <div className="w-16 h-1.5 bg-subtle rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${ticket.progress}%`, backgroundColor: statusColor }} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div className="text-center text-tx-ghost py-16 text-sm">{t.historyEmpty}</div>
      )}
    </div>
  );
}
