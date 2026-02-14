import { useState, useEffect } from 'react';
import { getAnalytics } from '../../api/tickets';
import { BarChart3, Coins, Code, FileText, CheckCircle, XCircle, Lock, Zap } from 'lucide-react';
import type { AnalyticsData } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-tx-faint text-sm">Chargement...</div>;
  if (!data) return <div className="p-8 text-tx-faint text-sm">Erreur de chargement.</div>;

  const statCards: StatCard[] = [
    { label: 'Total tickets', value: data.total, icon: FileText, color: '#94a3b8' },
    { label: 'Tokens utilisés', value: data.tokensTotal.toLocaleString(), icon: Zap, color: '#eab308' },
    { label: 'Coût total', value: `$${data.costTotal}`, icon: Coins, color: '#22c55e' },
    { label: 'Lignes ajoutées', value: `+${data.linesAdded.toLocaleString()}`, icon: Code, color: '#22c55e' },
    { label: 'Lignes supprimées', value: `-${data.linesRemoved.toLocaleString()}`, icon: Code, color: '#ef4444' },
    { label: 'Score moyen', value: `${data.avgScore}/100`, icon: BarChart3, color: '#a855f7' },
    { label: 'Taux approbation', value: `${data.approvalRate}%`, icon: CheckCircle, color: '#22c55e' },
    { label: 'Fichiers lockés', value: data.fileLocks, icon: Lock, color: '#f97316' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-th-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-tx-faint">{card.label}</span>
                <Icon size={14} style={{ color: card.color }} />
              </div>
              <div className="text-xl font-bold font-mono text-tx-primary">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* By status */}
        <div className="bg-card border border-th-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-tx-muted uppercase tracking-wider mb-3">Par statut</h3>
          <div className="space-y-2">
            {data.byStatus.map(item => (
              <div key={item.status} className="flex items-center justify-between">
                <span className="text-sm text-tx-tertiary">{item.status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(item.count / data.total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-tx-muted w-6 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By model */}
        <div className="bg-card border border-th-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-tx-muted uppercase tracking-wider mb-3">Claude vs GPT</h3>
          <div className="space-y-2">
            {data.byModel.map(item => (
              <div key={item.ai_model} className="flex items-center justify-between">
                <span className="text-sm text-tx-tertiary font-mono">{item.ai_model}</span>
                <span className="text-lg font-bold font-mono text-tx-primary">{item.count}</span>
              </div>
            ))}
            {data.byModel.length === 0 && <div className="text-xs text-tx-ghost">Aucune donnée</div>}
          </div>
        </div>

        {/* Top files */}
        <div className="bg-card border border-th-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-tx-muted uppercase tracking-wider mb-3">Fichiers les plus modifiés</h3>
          <div className="space-y-1.5">
            {data.topFiles.map(item => (
              <div key={item.file} className="flex items-center justify-between">
                <span className="text-xs font-mono text-tx-tertiary truncate flex-1 mr-2">{item.file}</span>
                <span className="text-xs font-mono text-tx-faint">{item.count}</span>
              </div>
            ))}
            {data.topFiles.length === 0 && <div className="text-xs text-tx-ghost">Aucune donnée</div>}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-th-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-tx-muted uppercase tracking-wider mb-3">Activité récente</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.recentActivity.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="text-[10px] text-tx-ghost shrink-0 w-10">
                  #{item.ticket_id}
                </span>
                <span className="text-xs text-tx-muted truncate">{item.message}</span>
              </div>
            ))}
            {data.recentActivity.length === 0 && <div className="text-xs text-tx-ghost">Aucune activité</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
