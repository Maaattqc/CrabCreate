import { AlertTriangle, Info, XCircle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import type { Ticket, ReviewData, ReviewIssue } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface SeverityConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
}

const SEVERITY_CONFIG: Record<ReviewIssue['severity'], SeverityConfig> = {
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

interface AIReviewTabProps {
  ticket: Ticket;
}

export default function AIReviewTab({ ticket }: AIReviewTabProps) {
  const { t } = useLanguage();
  let reviewData: ReviewData | null = null;
  try {
    reviewData = JSON.parse(ticket.ai_review_data || 'null');
  } catch {}

  if (!reviewData) {
    return <div className="p-4 text-xs text-tx-ghost text-center py-8">{t.noReview}</div>;
  }

  const score = reviewData.score || 0;
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const scoreBg = score >= 70 ? 'from-green-500/20' : score >= 50 ? 'from-amber-500/20' : 'from-red-500/20';

  return (
    <div className="p-4 space-y-4">
      {/* Score */}
      <div className={`flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r ${scoreBg} to-transparent`}>
        <div className={`text-3xl font-bold font-mono ${scoreColor}`}>{score}</div>
        <div>
          <div className="text-sm text-tx-tertiary font-medium">{t.reviewScore}</div>
          <div className="text-xs text-tx-faint">{reviewData.summary}</div>
        </div>
      </div>

      {/* Issues */}
      {reviewData.issues && reviewData.issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-tx-muted uppercase tracking-wider">{t.issues} ({reviewData.issues.length})</h4>
          {reviewData.issues.map((issue: ReviewIssue, i: number) => {
            const config = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.info;
            const Icon = config.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}>
                <Icon size={14} className={`mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1">
                  <p className="text-sm text-tx-tertiary">{issue.message}</p>
                  {issue.file && <span className="text-[10px] font-mono text-tx-faint mt-1 block">{issue.file}{issue.line ? `:${issue.line}` : ''}</span>}
                </div>
                <span className={`text-[10px] uppercase font-medium ${config.color}`}>{issue.severity}</span>
              </div>
            );
          })}
        </div>
      )}

      {(!reviewData.issues || reviewData.issues.length === 0) && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle size={14} />
          {t.noIssues}
        </div>
      )}
    </div>
  );
}
