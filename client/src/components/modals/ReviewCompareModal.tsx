import { X, Check, XCircle, ExternalLink } from 'lucide-react';
import { getColumnColor, getColumnLabel } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';
import type { Ticket } from '../../types';

interface ReviewCompareModalProps {
  ticket: Ticket;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export default function ReviewCompareModal({ ticket, onClose, onApprove, onReject }: ReviewCompareModalProps) {
  const { t } = useLanguage();
  const { currentProject } = useProject();
  const statusColor = getColumnColor(ticket.status);
  const statusLabel = getColumnLabel(ticket.status, t as unknown as Record<string, string>);
  const productionUrl = currentProject?.cf_site_url || null;
  const previewUrl = ticket.staging_url || null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex flex-col flex-1 m-4 bg-surface border border-th-border-strong rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-th-border shrink-0">
          <span className="text-xs font-mono text-tx-faint bg-subtle px-2 py-1 rounded">#{ticket.id}</span>
          <span
            className="text-xs px-3 py-1 rounded-full font-semibold tracking-wide uppercase"
            style={{ backgroundColor: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}30` }}
          >
            {statusLabel}
          </span>
          <h2 className="text-base font-bold text-tx-primary truncate">{ticket.title}</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body — 2-column iframes */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-hidden">
          {/* Before (Production) */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-medium text-tx-faint uppercase tracking-wide">{t.compareBefore}</span>
              {productionUrl && (
                <a href={productionUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
            {productionUrl ? (
              <div className="flex-1 rounded-lg border border-th-border overflow-hidden bg-white">
                <iframe src={productionUrl} className="w-full h-full" sandbox="allow-scripts allow-same-origin" title={t.compareBefore} />
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-th-border flex items-center justify-center bg-subtle">
                <span className="text-sm text-tx-faint">{t.compareNoProductionUrl}</span>
              </div>
            )}
          </div>
          {/* After (Preview) */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-medium text-tx-faint uppercase tracking-wide">{t.compareAfter}</span>
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
            {previewUrl ? (
              <div className="flex-1 rounded-lg border border-th-border overflow-hidden bg-white">
                <iframe src={previewUrl} className="w-full h-full" sandbox="allow-scripts allow-same-origin" title={t.compareAfter} />
              </div>
            ) : (
              <div className="flex-1 rounded-lg border border-th-border flex items-center justify-center bg-subtle">
                <span className="text-sm text-tx-faint">{t.compareNoPreviewUrl}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer — Approve / Reject */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-th-border shrink-0">
          <button onClick={() => onReject(ticket.id)} className="flex items-center gap-2 px-4 py-2 bg-red-500/15 text-red-400 text-sm font-medium rounded-lg hover:bg-red-500/25 border border-red-500/20 transition-all">
            <XCircle size={14} /> {t.reject}
          </button>
          <button onClick={() => onApprove(ticket.id)} className="flex items-center gap-2 px-4 py-2 bg-green-500/15 text-green-400 text-sm font-medium rounded-lg hover:bg-green-500/25 border border-green-500/20 transition-all">
            <Check size={14} /> {t.approve}
          </button>
        </div>
      </div>
    </div>
  );
}
