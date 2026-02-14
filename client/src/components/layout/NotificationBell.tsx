import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, MessageSquare, AtSign, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useAppNotifications } from '../../hooks/useAppNotifications';

interface NotificationBellProps {
  onTicketClick?: (ticketId: number, tab?: string) => void;
}

export default function NotificationBell({ onTicketClick }: NotificationBellProps) {
  const { t } = useLanguage();
  const { notifications, unread, markRead, markAllRead, remove } = useAppNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign size={12} className="text-amber-400" />;
      case 'comment': return <MessageSquare size={12} className="text-blue-400" />;
      case 'status': return <RefreshCw size={12} className="text-green-400" />;
      default: return <Bell size={12} className="text-tx-faint" />;
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '< 1m';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-tx-faint hover:text-tx-tertiary hover:bg-subtle-hover transition-all"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-th-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
            <h3 className="text-sm font-semibold text-tx-primary">{t.notificationsTitle}</h3>
            {unread > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                <CheckCheck size={12} /> {t.notificationsMarkAllRead}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-tx-faint text-xs py-8">{t.notificationsEmpty}</p>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-subtle/50 transition-colors cursor-pointer border-b border-th-border/50 last:border-0 ${
                    notif.read === 0 ? 'bg-amber-500/5' : ''
                  }`}
                  onClick={() => {
                    if (notif.read === 0) markRead(notif.id);
                    if (notif.ticket_id && onTicketClick) {
                      const tab = (notif.type === 'mention' || notif.type === 'comment') ? 'comments' : undefined;
                      onTicketClick(notif.ticket_id, tab);
                      setOpen(false);
                    }
                  }}
                >
                  <div className="mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-tx-primary truncate">{notif.title}</span>
                      {notif.read === 0 && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />}
                    </div>
                    <p className="text-[11px] text-tx-faint mt-0.5 line-clamp-2">{notif.message}</p>
                    <span className="text-[10px] text-tx-ghost mt-0.5 block">{formatDate(notif.created_at)}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); remove(notif.id); }}
                    className="p-1 rounded text-tx-ghost hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
