import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getPriorityColor } from '../../constants';
import type { Ticket } from '../../types';

interface CalendarViewProps {
  tickets: Ticket[];
  onTicketClick: (t: Ticket) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Sunday, adjust to Monday-start: Mon=0 .. Sun=6
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function CalendarView({ tickets, onTicketClick }: CalendarViewProps) {
  const { t, lang } = useLanguage();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const weekdays = lang === 'fr' ? WEEKDAYS_FR : WEEKDAYS_EN;
  const months = lang === 'fr' ? MONTHS_FR : MONTHS_EN;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const ticketsByDate = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    tickets.forEach(ticket => {
      if (ticket.due_date) {
        const dateStr = ticket.due_date.slice(0, 10);
        const existing = map.get(dateStr) || [];
        existing.push(ticket);
        map.set(dateStr, existing);
      }
    });
    return map;
  }, [tickets]);

  const noDateTickets = useMemo(() => {
    return tickets.filter(ticket => !ticket.due_date);
  }, [tickets]);

  const handlePrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const handleNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build grid cells
  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const cells: (number | null)[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const day = i - firstDay + 1;
    cells.push(day >= 1 && day <= daysInMonth ? day : null);
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-tx-primary">
              {months[month]} {year}
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

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {weekdays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-tx-faint py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px flex-1 auto-rows-fr">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={i} className="bg-subtle/30 rounded-md" />;
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTickets = ticketsByDate.get(dateStr) || [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={i}
                className={`rounded-md border p-1.5 min-h-[80px] overflow-y-auto ${
                  isToday
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-th-border bg-surface/50'
                }`}
              >
                <div className={`text-xs font-mono mb-1 ${isToday ? 'text-amber-400 font-bold' : 'text-tx-faint'}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayTickets.slice(0, 3).map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => onTicketClick(ticket)}
                      className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded hover:bg-subtle-hover transition-colors group"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                      />
                      <span className="text-[10px] text-tx-secondary truncate group-hover:text-tx-primary transition-colors">
                        {ticket.title}
                      </span>
                    </button>
                  ))}
                  {dayTickets.length > 3 && (
                    <span className="text-[9px] text-tx-ghost px-1">
                      +{dayTickets.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar: tickets without due date */}
      <div className="w-56 border-l border-th-border bg-surface/50 flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-3 border-b border-th-border">
          <h3 className="text-xs font-medium text-tx-faint">{t.dueDateNone}</h3>
          <span className="text-[10px] text-tx-ghost">{noDateTickets.length} tickets</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {noDateTickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => onTicketClick(ticket)}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-subtle-hover transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: getPriorityColor(ticket.priority) }}
              />
              <span className="text-xs text-tx-secondary truncate">{ticket.title}</span>
            </button>
          ))}
          {noDateTickets.length === 0 && (
            <p className="text-xs text-tx-ghost text-center py-4">{t.empty}</p>
          )}
        </div>
      </div>
    </div>
  );
}
