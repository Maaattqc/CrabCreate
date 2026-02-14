import { useState, useEffect, useRef } from 'react';
import { getTicketLogs } from '../../api/tickets';
import { useSocket } from '../../hooks/useSocket';
import { useLanguage } from '../../hooks/useLanguage';
import type { LogEntry } from '../../types';

const LOG_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  diff: 'text-tx-faint',
};

interface TerminalLogsProps {
  ticketId: number;
}

export default function TerminalLogs({ ticketId }: TerminalLogsProps) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { on, off } = useSocket();

  useEffect(() => {
    getTicketLogs(ticketId).then((data: LogEntry[]) => {
      setLogs(data.filter(l => l.log_type !== 'diff'));
    }).catch(() => {});
  }, [ticketId]);

  useEffect(() => {
    on('ticket:log', (data: { ticketId: number; message: string; logType: string; phase: string }) => {
      if (data.ticketId === ticketId && data.logType !== 'diff') {
        setLogs(prev => [...prev, {
          id: Date.now(),
          message: data.message,
          log_type: data.logType,
          phase: data.phase,
          created_at: new Date().toISOString(),
        }]);
      }
    });
    return () => off('ticket:log');
  }, [ticketId, on, off]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-base font-mono text-xs p-4 min-h-[200px]">
      {logs.length === 0 && (
        <div className="text-tx-ghost py-8 text-center">{t.noLogs}</div>
      )}
      {logs.map((log, i) => (
        <div key={log.id || i} className="flex gap-2 py-0.5 leading-relaxed">
          <span className="text-tx-ghost shrink-0 w-16">
            {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {log.phase && (
            <span className="text-tx-faint shrink-0 w-20 truncate">[{log.phase}]</span>
          )}
          <span className={LOG_COLORS[log.log_type] || 'text-tx-tertiary'}>{log.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
