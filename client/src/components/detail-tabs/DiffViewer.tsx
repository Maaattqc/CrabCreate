import { useState, useEffect } from 'react';
import { getTicketDiff } from '../../api/tickets';
import { useLanguage } from '../../hooks/useLanguage';

interface DiffViewerProps {
  ticketId: number;
}

export default function DiffViewer({ ticketId }: DiffViewerProps) {
  const { t } = useLanguage();
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTicketDiff(ticketId)
      .then((data: any) => setDiff(data.diff))
      .catch(() => setDiff(null))
      .finally(() => setLoading(false));
  }, [ticketId]);

  if (loading) {
    return <div className="p-4 text-xs text-tx-faint">{t.loadingDiff}</div>;
  }

  if (!diff) {
    return <div className="p-4 text-xs text-tx-ghost text-center py-8">{t.noDiff}</div>;
  }

  const lines = diff.split('\n');

  return (
    <div className="bg-base font-mono text-xs p-4 overflow-x-auto">
      {lines.map((line: string, i: number) => {
        let className = 'text-tx-muted';
        if (line.startsWith('+') && !line.startsWith('+++')) className = 'text-green-400 bg-green-500/5';
        else if (line.startsWith('-') && !line.startsWith('---')) className = 'text-red-400 bg-red-500/5';
        else if (line.startsWith('@@')) className = 'text-cyan-400';
        else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) className = 'text-tx-faint font-bold';

        return (
          <div key={i} className={`py-0.5 px-2 whitespace-pre ${className}`}>
            {line}
          </div>
        );
      })}
    </div>
  );
}
