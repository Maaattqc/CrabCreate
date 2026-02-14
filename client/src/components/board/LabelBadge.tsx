import { X } from 'lucide-react';
import type { Label } from '../../types';

interface LabelBadgeProps {
  label: Label;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

export default function LabelBadge({ label, size = 'sm', onRemove }: LabelBadgeProps) {
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-th-border ${
        isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } bg-subtle text-tx-secondary font-medium leading-none`}
    >
      <span
        className={`shrink-0 rounded-full ${isSm ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
        style={{ backgroundColor: label.color }}
      />
      <span className="truncate max-w-[80px]">{label.name}</span>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 text-tx-faint hover:text-tx-primary transition-colors"
        >
          <X size={isSm ? 10 : 12} />
        </button>
      )}
    </span>
  );
}
