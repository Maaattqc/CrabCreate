import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import type { Ticket, TestResults, TestResult } from '../../types';

interface TestsTabProps {
  ticket: Ticket;
}

export default function TestsTab({ ticket }: TestsTabProps) {
  const { t } = useLanguage();
  let testResults: TestResults | null = null;
  try {
    testResults = JSON.parse(ticket.test_results || 'null');
  } catch {}

  if (!testResults) {
    return <div className="p-4 text-xs text-tx-ghost text-center py-8">{t.noTests}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-3 bg-subtle rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-mono text-lg font-bold">{testResults.passed}</span>
          <span className="text-xs text-tx-faint">{t.passed}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-mono text-lg font-bold">{testResults.failed}</span>
          <span className="text-xs text-tx-faint">{t.failed}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-tx-muted font-mono text-lg font-bold">{testResults.total}</span>
          <span className="text-xs text-tx-faint">{t.total}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs text-tx-faint">
          <Clock size={12} />
          {testResults.duration}ms
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-subtle rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${(testResults.passed / testResults.total) * 100}%` }}
        />
      </div>

      {/* Test list */}
      <div className="space-y-1">
        {testResults.tests?.map((test: TestResult, i: number) => (
          <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-subtle">
            {test.status === 'passed' ? (
              <CheckCircle size={12} className="text-green-400 shrink-0" />
            ) : (
              <XCircle size={12} className="text-red-400 shrink-0" />
            )}
            <span className="text-xs font-mono text-tx-tertiary flex-1 truncate">{test.name}</span>
            <span className="text-[10px] text-tx-faint">{test.duration}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
