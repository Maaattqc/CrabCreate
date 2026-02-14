import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Star, X } from 'lucide-react';
import { COLUMNS, PRIORITIES } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import type { FilterState } from '../../hooks/useFilters';
import type { Label } from '../../types';

interface FilterBarProps {
  filters: FilterState;
  onSetStatuses: (s: string[]) => void;
  onSetPriorities: (p: string[]) => void;
  onSetAssignees: (a: string[]) => void;
  onSetDueDateFilter: (d: string) => void;
  onSetLabelIds: (l: number[]) => void;
  onSetShowFavorites: (f: boolean) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  labels: Label[];
  members: { email: string }[];
}

/* ── Generic multi-select dropdown ──────────────────────────────────────── */
interface DropdownProps {
  label: string;
  count: number;
  children: React.ReactNode;
}

function Dropdown({ label, count, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          count > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-card border-th-border text-tx-faint hover:text-tx-tertiary hover:border-th-border-strong'
        }`}
      >
        {label}
        {count > 0 && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
            {count}
          </span>
        )}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-th-border-strong rounded-xl shadow-xl shadow-black/30 z-50 py-1 max-h-64 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Checkbox row ────────────────────────────────────────────────────────── */
interface CheckRowProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CheckRow({ checked, onToggle, children }: CheckRowProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-tx-secondary hover:bg-subtle-hover transition-colors text-left"
    >
      <span
        className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
          checked
            ? 'bg-amber-500 border-amber-500'
            : 'border-th-border-strong bg-transparent'
        }`}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

/* ── Filter Bar component ────────────────────────────────────────────────── */
export default function FilterBar({
  filters,
  onSetStatuses,
  onSetPriorities,
  onSetAssignees,
  onSetDueDateFilter,
  onSetLabelIds,
  onSetShowFavorites,
  onClear,
  hasActiveFilters,
  labels,
  members,
}: FilterBarProps) {
  const { t } = useLanguage();

  const toggleInArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const toggleInNumberArray = (arr: number[], val: number) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const DUE_DATE_OPTIONS = [
    { id: 'all', label: t.filterAll },
    { id: 'overdue', label: t.dueDateOverdue },
    { id: 'today', label: t.dueDateToday },
    { id: 'this_week', label: t.dueDateThisWeek },
    { id: 'none', label: t.dueDateNone },
  ];

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 bg-subtle border-b border-th-border overflow-x-auto">
      {/* Status filter */}
      <Dropdown label={t.filterStatus} count={filters.statuses.length}>
        {COLUMNS.map(col => (
          <CheckRow
            key={col.id}
            checked={filters.statuses.includes(col.id)}
            onToggle={() => onSetStatuses(toggleInArray(filters.statuses, col.id))}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
            <span>{col.label}</span>
          </CheckRow>
        ))}
      </Dropdown>

      {/* Priority filter */}
      <Dropdown label={t.filterPriority} count={filters.priorities.length}>
        {PRIORITIES.map(p => (
          <CheckRow
            key={p.id}
            checked={filters.priorities.includes(p.id)}
            onToggle={() => onSetPriorities(toggleInArray(filters.priorities, p.id))}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="capitalize">{p.label}</span>
          </CheckRow>
        ))}
      </Dropdown>

      {/* Assignee filter */}
      <Dropdown label={t.filterAssignee} count={filters.assignees.length}>
        {members.length === 0 ? (
          <div className="px-3 py-2 text-xs text-tx-faint">{t.filterAll}</div>
        ) : (
          members.map(m => (
            <CheckRow
              key={m.email}
              checked={filters.assignees.includes(m.email)}
              onToggle={() => onSetAssignees(toggleInArray(filters.assignees, m.email))}
            >
              <span className="truncate">{m.email.split('@')[0]}</span>
            </CheckRow>
          ))
        )}
      </Dropdown>

      {/* Due date filter */}
      <Dropdown label={t.filterDueDate} count={filters.dueDateFilter !== 'all' ? 1 : 0}>
        {DUE_DATE_OPTIONS.map(opt => (
          <CheckRow
            key={opt.id}
            checked={filters.dueDateFilter === opt.id}
            onToggle={() => onSetDueDateFilter(opt.id)}
          >
            <span>{opt.label}</span>
          </CheckRow>
        ))}
      </Dropdown>

      {/* Labels filter */}
      <Dropdown label={t.filterLabel} count={filters.labelIds.length}>
        {labels.length === 0 ? (
          <div className="px-3 py-2 text-xs text-tx-faint">{t.labelNone}</div>
        ) : (
          labels.map(label => (
            <CheckRow
              key={label.id}
              checked={filters.labelIds.includes(label.id)}
              onToggle={() => onSetLabelIds(toggleInNumberArray(filters.labelIds, label.id))}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
              <span className="truncate">{label.name}</span>
            </CheckRow>
          ))
        )}
      </Dropdown>

      {/* Favorites toggle */}
      <button
        onClick={() => onSetShowFavorites(!filters.showFavorites)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          filters.showFavorites
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-card border-th-border text-tx-faint hover:text-tx-tertiary hover:border-th-border-strong'
        }`}
      >
        <Star size={12} fill={filters.showFavorites ? 'currentColor' : 'none'} />
        {t.favorites}
      </button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all ml-auto"
        >
          <X size={12} />
          {t.filterClear}
        </button>
      )}
    </div>
  );
}
