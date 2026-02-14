import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import type { Notification } from '../../types';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<Notification['type'], LucideIcon> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const COLORS: Record<Notification['type'], string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

interface NotificationToastProps {
  notifications: Notification[];
  onRemove: (id: number) => void;
}

export default function NotificationToast({ notifications, onRemove }: NotificationToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-1/2 right-4 -translate-y-1/2 z-50 space-y-2 max-w-sm">
      {notifications.map(n => {
        const Icon = ICONS[n.type] || Info;
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm animate-slide-in anim-toast ${COLORS[n.type] || COLORS.info}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="text-sm flex-1">{n.message}</span>
            <button onClick={() => onRemove(n.id)} className="shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
