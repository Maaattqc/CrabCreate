import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getColumnColor } from '../../constants';
import type { Ticket } from '../../types';

interface TimelineViewProps {
  tickets: Ticket[];
  onTicketClick: (t: Ticket) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function TimelineView({ tickets, onTicketClick }: TimelineViewProps) {
  const { t, lang } = useLanguage();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const scrollRef = useRef<HTMLDivElement>(null);

  const months = lang === 'fr' ? MONTHS_FR : MONTHS_EN;
  const daysInMonth = getDaysInMonth(year, month);

  const handlePrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const handleNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build range start/end as timestamps
  const rangeStart = new Date(year, month, 1).getTime();
  const rangeEnd = new Date(year, month, daysInMonth, 23, 59, 59).getTime();
  const rangeDuration = rangeEnd - rangeStart;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayTime = new Date(todayStr).getTime();

  // Compute bar positions for each ticket
  const ticketBars = useMemo(() => {
    return tickets.map(ticket => {
      const createdAt = new Date(ticket.created_at).getTime();
      const endDate = ticket.due_date
        ? new Date(ticket.due_date).getTime()
        : Date.now();

      // Clamp to visible range
      const barStart = Math.max(createdAt, rangeStart);
      const barEnd = Math.min(endDate, rangeEnd);

      // If fully outside range, skip
      if (barStart > rangeEnd || barEnd < rangeStart) {
        return { ticket, leftPct: 0, widthPct: 0, visible: false };
      }

      const leftPct = ((barStart - rangeStart) / rangeDuration) * 100;
      const widthPct = Math.max(((barEnd - barStart) / rangeDuration) * 100, 1);

      return { ticket, leftPct, widthPct, visible: true };
    });
  }, [tickets, rangeStart, rangeEnd, rangeDuration]);

  const DAY_WIDTH = 40; // px per day
  const totalWidth = daysInMonth * DAY_WIDTH;

  // Today marker position
  const todayPct = todayTime >= rangeStart && todayTime <= rangeEnd
    ? ((todayTime - rangeStart) / rangeDuration) * 100
    : -1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-tx-primary">
            {t.viewTimeline} — {months[month]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="p-2 rounded-lg text-tx-faint hover:bg-subtle-hover hover:text-tx-secondary transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-lg text-tx-faint hover:bg-subtle-hover hover:text-tx-secondary transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto border border-th-border rounded-lg bg-surface/50" ref={scrollRef}>
        <div style={{ minWidth: `${Math.max(totalWidth + 200, 600)}px` }}>
          {/* Day headers */}
          <div className="flex border-b border-th-border sticky top-0 bg-surface z-10">
            {/* Title column */}
            <div className="w-[200px] shrink-0 px-3 py-2 border-r border-th-border">
              <span className="text-xs font-medium text-tx-faint">Ticket</span>
            </div>
            {/* Days */}
            <div className="flex-1 relative flex">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                const isToday = dayStr === todayStr;
                return (
                  <div
                    key={i}
                    className={`text-center text-[10px] py-2 border-r border-th-border/50 ${
                      isToday ? 'text-amber-400 font-bold bg-amber-500/5' : 'text-tx-ghost'
                    }`}
                    style={{ width: `${DAY_WIDTH}px`, minWidth: `${DAY_WIDTH}px` }}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ticket rows */}
          {ticketBars.map(({ ticket, leftPct, widthPct, visible }) => {
            const color = getColumnColor(ticket.status);
            return (
              <div
                key={ticket.id}
                className="flex border-b border-th-border/50 hover:bg-subtle/50 transition-colors"
              >
                {/* Title */}
                <div className="w-[200px] shrink-0 px-3 py-2 border-r border-th-border">
                  <button
                    onClick={() => onTicketClick(ticket)}
                    className="text-xs text-tx-secondary truncate block text-left hover:text-amber-400 transition-colors w-full"
                  >
                    <span className="text-tx-ghost font-mono">#{ticket.id}</span>{' '}
                    {ticket.title}
                  </button>
                </div>
                {/* Bar area */}
                <div className="flex-1 relative h-10">
                  {/* Today marker */}
                  {todayPct >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-amber-500/40 z-[1]"
                      style={{ left: `${todayPct}%` }}
                    />
                  )}
                  {visible && (
                    <button
                      onClick={() => onTicketClick(ticket)}
                      className="absolute top-1.5 h-5 rounded-md cursor-pointer hover:opacity-80 transition-opacity z-[2]"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        minWidth: '8px',
                        backgroundColor: color + '40',
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={`${ticket.title} (${ticket.status})`}
                    >
                      <span className="text-[9px] text-tx-secondary truncate block px-1 leading-5">
                        {ticket.title}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {tickets.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-tx-faint">
              {t.empty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
