import { Plus } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TicketCard from './TicketCard';
import SortableTicketCard from './SortableTicketCard';
import { useLanguage } from '../../hooks/useLanguage';
import { getColumnLabel } from '../../constants';
import type { Column as ColumnType, Ticket, TicketViewer } from '../../types';

interface ColumnProps {
  column: ColumnType;
  tickets: Ticket[];
  onTicketClick: (t: Ticket) => void;
  onLaunch: (id: number) => void;
  onCreateClick?: () => void;
  stepNumber: number;
  totalTickets?: number;
  getViewers?: (ticketId: number) => TicketViewer[];
  isDragging?: (ticketId: number) => { userId: number; email: string } | null;
}

export default function Column({ column, tickets, onTicketClick, onLaunch, onCreateClick, stepNumber, totalTickets = 0, getViewers, isDragging }: ColumnProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col flex-1 min-w-[140px] px-1.5" data-column={column.id}>
      {/* Column header */}
      <div className="mb-2 pt-1">
        <div className="flex items-center gap-2 px-1.5 py-1.5">
          <span
            className="text-xs font-mono font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0 anim-step"
            style={{ backgroundColor: column.color + '25', color: column.color, animationDelay: `${stepNumber * 0.3}s` }}
          >
            {stepNumber}
          </span>
          <span className="text-sm font-bold text-tx-secondary truncate">{getColumnLabel(column.id, t as unknown as Record<string, string>)}</span>
          <span
            className="text-xs font-mono font-semibold ml-auto px-2 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: tickets.length > 0 ? column.color + '20' : 'transparent',
              color: tickets.length > 0 ? column.color : 'var(--color-text-ghost)',
            }}
          >
            {tickets.length}
          </span>
          {column.id === 'backlog' && onCreateClick && (
            <button
              onClick={onCreateClick}
              className="btn-create p-1.5 shrink-0"
              title={t.newTicket}
              data-onboard="create-ticket"
            >
              <Plus size={14} strokeWidth={3} className="btn-create-icon" />
            </button>
          )}
        </div>
        {/* Colored accent line under header */}
        <div
          className="h-[2px] rounded-full mx-1.5 opacity-60 anim-accent"
          style={{ backgroundColor: column.color, animationDelay: `${stepNumber * 0.2}s` }}
        />
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-1.5 px-0.5 overflow-y-auto pb-4 scrollbar-thin">
        {column.id === 'backlog' ? (
          <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tickets.map(ticket => (
              <SortableTicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={onTicketClick}
                onLaunch={onLaunch}
                viewers={getViewers?.(ticket.id)}
                draggingBy={isDragging?.(ticket.id)}
              />
            ))}
          </SortableContext>
        ) : (
          tickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={onTicketClick}
              onLaunch={onLaunch}
              viewers={getViewers?.(ticket.id)}
              draggingBy={isDragging?.(ticket.id)}
            />
          ))
        )}
        {tickets.length === 0 && column.id === 'backlog' && onCreateClick && totalTickets === 0 && (
          <button
            onClick={onCreateClick}
            className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed border-amber-500/30 bg-amber-500/[0.03] hover:bg-amber-500/[0.08] hover:border-amber-500/50 transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/25 animate-bounce">
              <Plus size={20} strokeWidth={3} className="text-white" />
            </div>
            <span className="text-xs font-medium text-amber-400/80 group-hover:text-amber-400 transition-colors">{t.newTicket}</span>
          </button>
        )}
        {tickets.length === 0 && (column.id !== 'backlog' || !onCreateClick) && (
          <div className="text-xs text-tx-ghost text-center py-6 italic">{t.empty}</div>
        )}
      </div>
    </div>
  );
}
