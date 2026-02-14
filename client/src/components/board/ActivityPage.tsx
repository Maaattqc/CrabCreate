import { useState, useMemo } from 'react';
import { Activity, Plus, ArrowRightLeft, MessageSquare, Cpu, Filter, Inbox } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getColumnColor, COLUMNS } from '../../constants';
import type { Ticket } from '../../types';

interface ActivityPageProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

type ActivityType = 'all' | 'status_change' | 'comment' | 'pipeline' | 'create';

interface ActivityEntry {
  id: string;
  ticket: Ticket;
  type: ActivityType;
  date: string;
  message: string;
}

const TYPE_ICONS: Record<ActivityType, typeof Activity> = {
  all: Activity,
  status_change: ArrowRightLeft,
  comment: MessageSquare,
  pipeline: Cpu,
  create: Plus,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getDateKey(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

export default function ActivityPage({ tickets, onTicketClick }: ActivityPageProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ActivityType>('all');
  const [visibleCount, setVisibleCount] = useState(50);

  // Build activity entries from tickets
  const allEntries = useMemo(() => {
    const entries: ActivityEntry[] = [];

    for (const ticket of tickets) {
      // Created entry
      entries.push({
        id: `create-${ticket.id}`,
        ticket,
        type: 'create',
        date: ticket.created_at,
        message: `#${ticket.id} ${ticket.title}`,
      });

      // Updated entry (if different from created)
      if (ticket.updated_at !== ticket.created_at) {
        const isStatusChange = true; // We treat updates as status changes
        entries.push({
          id: `update-${ticket.id}`,
          ticket,
          type: isStatusChange ? 'status_change' : 'comment',
          date: ticket.updated_at,
          message: `#${ticket.id} ${ticket.title}`,
        });
      }

      // Pipeline entry (if ticket has progressed through AI stages)
      if (['ai_coding', 'ai_review', 'testing', 'deploying', 'staging', 'approved'].includes(ticket.status)) {
        entries.push({
          id: `pipeline-${ticket.id}`,
          ticket,
          type: 'pipeline',
          date: ticket.updated_at,
          message: `#${ticket.id} ${ticket.title}`,
        });
      }
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }, [tickets]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return allEntries;
    return allEntries.filter(e => e.type === filter);
  }, [allEntries, filter]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; entries: ActivityEntry[] }[] = [];
    let currentKey = '';

    for (const entry of visibleEntries) {
      const key = getDateKey(entry.date);
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ date: entry.date, entries: [entry] });
      } else {
        groups[groups.length - 1].entries.push(entry);
      }
    }

    return groups;
  }, [visibleEntries]);

  const filterButtons: { type: ActivityType; label: string }[] = [
    { type: 'all', label: t.filterAll },
    { type: 'create', label: t.create },
    { type: 'status_change', label: t.notificationsStatusChange },
    { type: 'pipeline', label: 'Pipeline' },
  ];

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-tx-primary">{t.activityPage}</h2>
          <span className="text-xs text-tx-faint bg-subtle px-2 py-0.5 rounded-full">
            {filteredEntries.length}
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6">
        <Filter size={14} className="text-tx-faint" />
        <span className="text-xs text-tx-faint mr-1">{t.activityFilter}:</span>
        {filterButtons.map(btn => (
          <button
            key={btn.type}
            onClick={() => setFilter(btn.type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === btn.type
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-subtle text-tx-faint hover:text-tx-secondary hover:bg-subtle-hover'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Activity feed */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-tx-ghost">
          <Inbox size={40} className="mb-3 opacity-50" />
          <p className="text-sm">{t.activityEmpty}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={getDateKey(group.date)}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-tx-faint uppercase tracking-wider">
                  {formatDate(group.date)}
                </span>
                <div className="flex-1 h-px bg-th-border" />
              </div>

              {/* Entries */}
              <div className="space-y-1">
                {group.entries.map(entry => {
                  const Icon = TYPE_ICONS[entry.type] || Activity;
                  const statusColor = getColumnColor(entry.ticket.status);
                  const statusLabel = COLUMNS.find(c => c.id === entry.ticket.status)?.label || entry.ticket.status;

                  return (
                    <button
                      key={entry.id}
                      onClick={() => onTicketClick(entry.ticket)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-subtle transition-colors text-left group"
                    >
                      {/* Icon */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: statusColor + '20' }}
                      >
                        <Icon size={14} style={{ color: statusColor }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-tx-faint">#{entry.ticket.id}</span>
                          <span className="text-sm text-tx-secondary truncate group-hover:text-tx-primary transition-colors">
                            {entry.ticket.title}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ backgroundColor: statusColor + '20', color: statusColor }}
                      >
                        {statusLabel}
                      </span>

                      {/* Time */}
                      <span className="text-xs text-tx-faint shrink-0">
                        {formatTime(entry.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {visibleCount < filteredEntries.length && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount(prev => prev + 50)}
                className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-colors"
              >
                {t.adminLoadMore}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
