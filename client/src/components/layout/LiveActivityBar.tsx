import { Cpu } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getColumnLabel } from '../../constants';
import type { Ticket } from '../../types';

interface LiveActivityBarProps {
  tickets: Ticket[];
}

const ACTIVE_STATUSES = ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying'];

export default function LiveActivityBar({ tickets }: LiveActivityBarProps) {
  const { t } = useLanguage();
  const activeTickets = tickets.filter(tk => ACTIVE_STATUSES.includes(tk.status));
  const idle = activeTickets.length === 0;

  return (
    <div className={`h-7 border-t border-th-border flex items-center px-4 gap-3 text-[11px] ${idle ? 'ai-live-idle' : ''}`}>
      <div className="ai-live-dot shrink-0" />
      {idle ? (
        <span className="text-tx-ghost font-mono">{t.liveIdle}</span>
      ) : (
        <div className="flex items-center gap-4 overflow-hidden flex-1">
          {activeTickets.slice(0, 3).map(tk => (
            <span key={tk.id} className="flex items-center gap-1.5 text-tx-muted font-mono shrink-0">
              <Cpu size={10} className="text-amber-400" />
              <span className="text-amber-400">AI</span>
              <span className="text-tx-ghost">{t.liveWorking}</span>
              <span className="text-tx-secondary">#{tk.id}</span>
              <span className="text-tx-ghost">—</span>
              <span className="text-tx-faint">{getColumnLabel(tk.status, t as unknown as Record<string, string>)}</span>
              <span className="text-tx-ghost">{tk.progress}%</span>
            </span>
          ))}
          {activeTickets.length > 3 && (
            <span className="text-tx-ghost font-mono">+{activeTickets.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
