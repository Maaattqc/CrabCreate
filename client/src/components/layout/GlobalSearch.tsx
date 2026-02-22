import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Hash, MessageSquare, Activity, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { globalSearch } from '../../api/search';
import VoiceInput from '../common/VoiceInput';
import type { SearchResult } from '../../types';

interface GlobalSearchProps {
  onClose: () => void;
  onTicketSelect: (ticketId: number) => void;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  ticket: <Hash size={14} className="text-amber-400" />,
  comment: <MessageSquare size={14} className="text-blue-400" />,
  activity: <Activity size={14} className="text-green-400" />,
};

export default function GlobalSearch({ onClose, onTicketSelect }: GlobalSearchProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await globalSearch(q);
      setResults(data);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  useEffect(() => { setIdx(0); }, [results]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Group results
  const ticketResults = results.filter(r => r.type === 'ticket');
  const commentResults = results.filter(r => r.type === 'comment');
  const activityResults = results.filter(r => r.type === 'activity');
  const allResults = [...ticketResults, ...commentResults, ...activityResults];

  // Scroll active result into view
  useEffect(() => {
    if (resultsRef.current) {
      const active = resultsRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }, [idx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, allResults.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (allResults[idx]) {
          onTicketSelect(allResults[idx].ticket_id);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allResults, idx, onTicketSelect, onClose]);

  const getTypeLabel = (type: string) => {
    if (type === 'ticket') return t.searchTickets;
    if (type === 'comment') return t.searchComments;
    if (type === 'activity') return t.searchActivity;
    return type;
  };

  let flatIdx = 0;

  const renderGroup = (groupResults: SearchResult[], label: string) => {
    if (groupResults.length === 0) return null;
    return (
      <div>
        <div className="px-4 py-1.5 text-[10px] font-semibold text-tx-ghost uppercase tracking-wider">
          {label}
        </div>
        {groupResults.map(result => {
          const currentIdx = flatIdx++;
          return (
            <button
              key={`${result.type}-${result.id}`}
              data-active={currentIdx === idx}
              onClick={() => { onTicketSelect(result.ticket_id); onClose(); }}
              onMouseEnter={() => setIdx(currentIdx)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                currentIdx === idx ? 'bg-subtle-hover' : 'hover:bg-subtle'
              }`}
            >
              <span className="shrink-0">{TYPE_ICON[result.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-tx-secondary truncate">{result.title}</p>
                {result.snippet && (
                  <p className="text-[11px] text-tx-ghost truncate">{result.snippet}</p>
                )}
              </div>
              <span className="text-[10px] text-tx-ghost font-mono shrink-0">#{result.ticket_id}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 bg-surface border border-th-border-strong rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-th-border">
          <Search size={16} className="text-tx-faint shrink-0" />
          <VoiceInput
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.globalSearch}
            className="flex-1 bg-transparent text-sm text-tx-primary placeholder-tx-ghost focus:outline-none"
            containerClassName="flex-1"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-tx-ghost hover:text-tx-faint">
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] text-tx-ghost bg-subtle px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-1" ref={resultsRef}>
          {loading && (
            <div className="text-xs text-tx-ghost text-center py-6">{t.loading}</div>
          )}

          {!loading && query.trim() && allResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Search size={28} className="text-tx-ghost" />
              <p className="text-sm text-tx-faint">{t.searchNoResults}</p>
            </div>
          )}

          {!loading && allResults.length > 0 && (
            <>
              {renderGroup(ticketResults, getTypeLabel('ticket'))}
              {renderGroup(commentResults, getTypeLabel('comment'))}
              {renderGroup(activityResults, getTypeLabel('activity'))}
            </>
          )}

          {!loading && !query.trim() && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Search size={28} className="text-tx-ghost" />
              <p className="text-sm text-tx-faint">{t.globalSearch}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
