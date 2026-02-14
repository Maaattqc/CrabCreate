import { useLanguage } from '../../hooks/useLanguage';
import { useUserStatus } from '../../hooks/useCollaboration';
import type { PresenceUser } from '../../types';

interface PresenceAvatarsProps {
  users: PresenceUser[];
  maxVisible?: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-500',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
};

function getInitial(email: string): string {
  return (email[0] || '?').toUpperCase();
}

export default function PresenceAvatars({ users, maxVisible = 5 }: PresenceAvatarsProps) {
  const { t } = useLanguage();
  const { getStatus } = useUserStatus();

  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div
      className="flex items-center gap-1"
      title={t.usersOnline.replace('{count}', String(users.length))}
    >
      {/* Pulsing green dot */}
      <span className="relative flex h-2 w-2 mr-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>

      {visible.map(u => {
        const status = getStatus(u.userId);
        return (
          <div key={u.userId} className="relative -ml-1 first:ml-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-surface"
              style={{ backgroundColor: u.color }}
              title={`${u.email} (${status})`}
            >
              {getInitial(u.email)}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface ${STATUS_COLORS[status] || STATUS_COLORS.available}`} />
          </div>
        );
      })}

      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-tx-faint bg-subtle border border-th-border -ml-1">
          +{overflow}
        </div>
      )}
    </div>
  );
}
