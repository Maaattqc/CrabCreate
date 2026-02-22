import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, Square, Loader2, Bot } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useSubtasks } from '../../hooks/useSubtasks';
import VoiceInput from '../common/VoiceInput';

interface SubtasksTabProps {
  ticketId: number;
}

export default function SubtasksTab({ ticketId }: SubtasksTabProps) {
  const { t } = useLanguage();
  const { subtasks, loading, fetch, create, toggle, remove, completed, total, progress, codingSubtaskId } = useSubtasks(ticketId);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleAdd = async () => {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      await create(newTitle.trim());
      setNewTitle('');
    } catch { /* ignore */ }
    setAdding(false);
  };

  const progressLabel = t.subtaskProgress
    .replace('{done}', String(completed))
    .replace('{total}', String(total));

  return (
    <div className="p-6">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-tx-primary">{t.subtasks}</h3>
        {total > 0 && (
          <span className="text-[11px] text-tx-faint font-mono">{progressLabel}</span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="w-full h-1.5 bg-subtle rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: progress === 100
                ? 'linear-gradient(to right, #22c55e, #4ade80)'
                : 'linear-gradient(to right, #f59e0b, #fbbf24)',
            }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-tx-faint" />
        </div>
      )}

      {/* Subtask list */}
      {!loading && subtasks.length === 0 && (
        <p className="text-xs text-tx-faint text-center py-6">{t.subtaskEmpty}</p>
      )}

      {!loading && (
        <div className="space-y-0.5 mb-4">
          {subtasks.map(subtask => {
            const isCoding = codingSubtaskId === subtask.id;
            return (
              <div
                key={subtask.id}
                className={`group flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                  isCoding ? 'bg-amber-500/10 ring-1 ring-amber-500/20' : 'hover:bg-subtle-hover'
                }`}
              >
                <button
                  onClick={() => toggle(subtask.id)}
                  className="shrink-0 mt-0.5 text-tx-faint hover:text-amber-400 transition-colors"
                >
                  {isCoding ? (
                    <Loader2 size={16} className="animate-spin text-amber-400" />
                  ) : subtask.completed ? (
                    <CheckSquare size={16} className="text-green-400" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm transition-colors ${
                        subtask.completed
                          ? 'text-tx-faint line-through'
                          : 'text-tx-secondary'
                      }`}
                    >
                      {subtask.title}
                    </span>
                    {subtask.ai_generated === 1 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-400">
                        <Bot size={10} />
                        {t.subtaskAiBadge}
                      </span>
                    )}
                    {isCoding && (
                      <span className="text-[10px] text-amber-400 font-medium animate-pulse">
                        {t.subtaskCoding}
                      </span>
                    )}
                  </div>
                  {subtask.description && (
                    <p className="text-xs text-tx-faint mt-0.5 leading-relaxed">
                      {subtask.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(subtask.id)}
                  className="shrink-0 p-1 rounded text-tx-faint opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new subtask */}
      <div className="flex items-center gap-2 pt-2 border-t border-th-border">
        <VoiceInput
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          className="flex-1 bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50 placeholder-tx-ghost"
          placeholder={t.subtaskPlaceholder}
          maxLength={200}
          containerClassName="flex-1"
        />
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim() || adding}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} />
          {t.subtaskAdd}
        </button>
      </div>
    </div>
  );
}
