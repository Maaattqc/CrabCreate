import { X, Check, XCircle } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';

interface InvitationsModalProps {
  onClose: () => void;
}

export default function InvitationsModal({ onClose }: InvitationsModalProps) {
  const { t } = useLanguage();
  const { invitations, acceptInvitation, rejectInvitation } = useProject();

  const handleAccept = async (token: string) => {
    try { await acceptInvitation(token); } catch { /* ignore */ }
  };

  const handleReject = async (token: string) => {
    try { await rejectInvitation(token); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-[fadeSlideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-tx-primary">{t.projectInvitations}</h2>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-secondary"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {invitations.length === 0 ? (
            <p className="text-sm text-tx-faint text-center py-8">{t.projectNoInvitations}</p>
          ) : (
            invitations.map(inv => (
              <div key={inv.id} className="border border-th-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-tx-primary">{inv.project_name}</span>
                  <span className="text-xs text-tx-faint bg-subtle px-1.5 py-0.5 rounded">{inv.role}</span>
                </div>
                <p className="text-xs text-tx-faint">
                  {inv.inviter_email}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAccept(inv.token)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
                  >
                    <Check size={14} /> {t.projectAccept}
                  </button>
                  <button
                    onClick={() => handleReject(inv.token)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
                  >
                    <XCircle size={14} /> {t.projectReject}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
