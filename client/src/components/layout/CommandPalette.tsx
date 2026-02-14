import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Hash, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getColumnLabel } from '../../constants';
import type { Ticket } from '../../types';

interface CommandPaletteProps {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  onClose: () => void;
  onCreate: () => void;
}

export default function CommandPalette({ tickets, onSelect, onClose, onCreate }: CommandPaletteProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return tickets.slice(0, 8);
    const q = query.toLowerCase();
    return tickets.filter(tk =>
      tk.title.toLowerCase().includes(q) ||
      (tk.description || '').toLowerCase().includes(q) ||
      `#${tk.id}`.includes(q) ||
      tk.status.includes(q) ||
      (tk.tags || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, tickets]);

  useEffect(() => { setIdx(0); }, [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx === results.length) { onCreate(); onClose(); }
        else if (results[idx]) { onSelect(results[idx]); onClose(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, idx, onSelect, onClose, onCreate]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="ai-cmd-modal w-full max-w-lg mx-4 bg-surface border border-th-border-strong rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-th-border">
          <Search size={16} className="text-tx-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.cmdPlaceholder}
            className="flex-1 bg-transparent text-sm text-tx-primary placeholder-tx-ghost focus:outline-none"
          />
          <kbd className="text-[10px] text-tx-ghost bg-subtle px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="text-xs text-tx-ghost text-center py-6">{t.cmdNoResults}</div>
          )}
          {results.map((tk, i) => (
            <button
              key={tk.id}
              onClick={() => { onSelect(tk); onClose(); }}
              onMouseEnter={() => setIdx(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === idx ? 'bg-subtle-hover' : 'hover:bg-subtle'
              }`}
            >
              <Hash size={13} className="text-tx-ghost shrink-0" />
              <span className="text-xs font-mono text-tx-faint w-8">#{tk.id}</span>
              <span className="text-sm text-tx-secondary truncate flex-1">{tk.title}</span>
              <span className="text-[10px] text-tx-ghost font-mono">{getColumnLabel(tk.status, t as unknown as Record<string, string>)}</span>
              {tk.tags && tk.tags !== '[]' && (
                <div className="flex gap-1">
                  {tk.tags.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean).slice(0, 2).map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">{tag}</span>
                  ))}
                </div>
              )}
              {i === idx && <ArrowRight size={12} className="text-amber-400 shrink-0" />}
            </button>
          ))}

          {/* Create option at bottom */}
          <button
            onClick={() => { onCreate(); onClose(); }}
            onMouseEnter={() => setIdx(results.length)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-th-border transition-colors ${
              idx === results.length ? 'bg-subtle-hover' : 'hover:bg-subtle'
            }`}
          >
            <span className="text-amber-400 font-bold text-sm">+</span>
            <span className="text-sm text-tx-tertiary">{t.newTicket}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
