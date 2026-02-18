import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Check, XCircle, ExternalLink, Loader2, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { getColumnColor, getColumnLabel } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';
import { getTicket } from '../../api/tickets';
import type { Ticket } from '../../types';

interface ReviewCompareModalProps {
  ticket: Ticket;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

function IframeSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-subtle animate-pulse z-10">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={40} className="animate-spin text-tx-faint" />
        <div className="space-y-3 w-64">
          <div className="h-3 bg-white/5 rounded-full w-full" />
          <div className="h-3 bg-white/5 rounded-full w-4/5" />
          <div className="h-3 bg-white/5 rounded-full w-3/5" />
          <div className="h-20 bg-white/5 rounded-lg w-full mt-4" />
          <div className="h-3 bg-white/5 rounded-full w-full" />
          <div className="h-3 bg-white/5 rounded-full w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Extract the page path from a staging URL (e.g. https://xxx.pages.dev/about.html → /about.html)
 * and apply it to the production URL so both iframes show the same page.
 */
function getBeforeUrl(productionUrl: string, previewUrl: string | null): string {
  if (!previewUrl) return productionUrl;
  try {
    const parsed = new URL(previewUrl);
    const pathPart = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    const hashPart = parsed.hash || '';
    if (pathPart || hashPart) {
      return productionUrl.replace(/\/+$/, '') + pathPart + hashPart;
    }
  } catch { /* ignore */ }
  return productionUrl;
}

/** Try to scroll an iframe's content (best-effort, fails silently on cross-origin). */
function scrollIframe(iframe: HTMLIFrameElement | null, position: 'top' | 'bottom') {
  if (!iframe) return;
  try {
    const win = iframe.contentWindow;
    if (!win) return;
    if (position === 'bottom') {
      // Try to access scrollHeight — throws on cross-origin
      const h = win.document.documentElement.scrollHeight || win.document.body.scrollHeight;
      win.scrollTo({ top: h, behavior: 'smooth' });
    } else {
      win.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch {
    // Cross-origin — cannot scroll programmatically
  }
}

export default function ReviewCompareModal({ ticket, onClose, onApprove, onReject }: ReviewCompareModalProps) {
  const { t } = useLanguage();
  const { currentProject } = useProject();
  const statusColor = getColumnColor(ticket.status);
  const statusLabel = getColumnLabel(ticket.status, t as unknown as Record<string, string>);
  const productionUrl = currentProject?.cf_site_url || null;

  // Iframe refs for scroll control
  const beforeRef = useRef<HTMLIFrameElement>(null);
  const afterRef = useRef<HTMLIFrameElement>(null);

  // Fetch fresh ticket data to ensure staging_url is up-to-date
  const [freshStagingUrl, setFreshStagingUrl] = useState<string | null>(ticket.staging_url || null);
  const [loadingPreview, setLoadingPreview] = useState(!ticket.staging_url);

  // Track iframe load state
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);

  useEffect(() => {
    if (ticket.staging_url) {
      setFreshStagingUrl(ticket.staging_url);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    getTicket(ticket.id)
      .then(fresh => {
        if (!cancelled && fresh.staging_url) {
          setFreshStagingUrl(fresh.staging_url);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [ticket.id, ticket.staging_url]);

  const previewUrl = freshStagingUrl || null;

  // Before URL: production URL + same page path as preview
  const beforeUrl = useMemo(
    () => productionUrl ? getBeforeUrl(productionUrl, previewUrl) : null,
    [productionUrl, previewUrl],
  );

  const handleBeforeLoad = useCallback(() => {
    setBeforeLoaded(true);
    // Auto-scroll to bottom so the user sees footer / bottom changes
    scrollIframe(beforeRef.current, 'bottom');
  }, []);
  const handleAfterLoad = useCallback(() => {
    setAfterLoaded(true);
    scrollIframe(afterRef.current, 'bottom');
  }, []);

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

        {/* Body — 2-column iframes (navigable) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-hidden">
          {/* Before (Production) */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-medium text-tx-faint uppercase tracking-wide">{t.compareBefore}</span>
              <div className="flex items-center gap-1.5">
                {beforeLoaded && (
                  <>
                    <button onClick={() => scrollIframe(beforeRef.current, 'top')} className="p-0.5 rounded text-tx-faint hover:text-tx-primary transition-colors" title="Scroll to top">
                      <ArrowUpToLine size={12} />
                    </button>
                    <button onClick={() => scrollIframe(beforeRef.current, 'bottom')} className="p-0.5 rounded text-tx-faint hover:text-tx-primary transition-colors" title="Scroll to bottom">
                      <ArrowDownToLine size={12} />
                    </button>
                  </>
                )}
                {beforeUrl && (
                  <a href={beforeUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            {beforeUrl ? (
              <div className="relative flex-1 rounded-xl border border-th-border overflow-hidden bg-white">
                {!beforeLoaded && <IframeSkeleton />}
                <iframe ref={beforeRef} src={beforeUrl} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title={t.compareBefore} onLoad={handleBeforeLoad} />
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-th-border flex items-center justify-center bg-subtle">
                <span className="text-sm text-tx-faint">{t.compareNoProductionUrl}</span>
              </div>
            )}
          </div>
          {/* After (Preview) */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="text-xs font-medium text-tx-faint uppercase tracking-wide">{t.compareAfter}</span>
              <div className="flex items-center gap-1.5">
                {afterLoaded && (
                  <>
                    <button onClick={() => scrollIframe(afterRef.current, 'top')} className="p-0.5 rounded text-tx-faint hover:text-tx-primary transition-colors" title="Scroll to top">
                      <ArrowUpToLine size={12} />
                    </button>
                    <button onClick={() => scrollIframe(afterRef.current, 'bottom')} className="p-0.5 rounded text-tx-faint hover:text-tx-primary transition-colors" title="Scroll to bottom">
                      <ArrowDownToLine size={12} />
                    </button>
                  </>
                )}
                {previewUrl && (
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            {loadingPreview ? (
              <div className="flex-1 rounded-xl border border-th-border flex items-center justify-center bg-subtle">
                <Loader2 size={18} className="animate-spin text-tx-faint mr-2" />
                <span className="text-sm text-tx-faint">{t.compareLoadingPreview}</span>
              </div>
            ) : previewUrl ? (
              <div className="relative flex-1 rounded-xl border border-th-border overflow-hidden bg-white">
                {!afterLoaded && <IframeSkeleton />}
                {/* Wait for Before to load first so the user sees left→right progression */}
                {beforeLoaded && (
                  <iframe ref={afterRef} src={previewUrl} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title={t.compareAfter} onLoad={handleAfterLoad} />
                )}
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-th-border flex items-center justify-center bg-subtle">
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
