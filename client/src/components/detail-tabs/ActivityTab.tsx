import { useState, useEffect } from 'react';
import { getTicketActivity } from '../../api/tickets';
import { useLanguage } from '../../hooks/useLanguage';
import type { ActivityItem } from '../../types';

const ACTIVITY_COLORS: Record<string, string> = {
  create: 'text-blue-400',
  estimate: 'text-cyan-400',
  ai: 'text-amber-400',
  ai_review: 'text-purple-400',
  test: 'text-teal-400',
  push: 'text-blue-400',
  pr: 'text-indigo-400',
  staging: 'text-sky-400',
  deploy: 'text-blue-400',
  approve: 'text-green-400',
  reject: 'text-red-400',
  retry: 'text-amber-400',
  rollback: 'text-orange-400',
  chat: 'text-tx-muted',
  queue: 'text-orange-400',
};

interface ActivityTabProps {
  ticketId: number;
}

export default function ActivityTab({ ticketId }: ActivityTabProps) {
  const { t } = useLanguage();
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    getTicketActivity(ticketId).then(setActivity).catch(() => {});
  }, [ticketId]);

  if (activity.length === 0) {
    return <div className="p-4 text-xs text-tx-ghost text-center py-8">{t.noActivity}</div>;
  }

  return (
    <div className="p-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-th-border" />

        <div className="space-y-3">
          {activity.map((item, i) => {
            const color = ACTIVITY_COLORS[item.activity_type] || 'text-tx-muted';
            return (
              <div key={item.id || i} className="flex gap-3 relative">
                <div className={`w-3.5 h-3.5 rounded-full border-2 bg-surface shrink-0 mt-0.5 z-10`} style={{ borderColor: 'currentColor' }}>
                  <div className={`w-full h-full rounded-full ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-tx-tertiary">{item.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] uppercase font-medium ${color}`}>{item.activity_type}</span>
                    <span className="text-[10px] text-tx-ghost">
                      {new Date(item.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
