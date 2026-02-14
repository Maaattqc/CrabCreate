import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface ShortcutsPanelProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'N', i18nKey: 'shortcutNewTicket' },
  { key: 'J', i18nKey: 'shortcutNextTicket' },
  { key: 'K', i18nKey: 'shortcutPrevTicket' },
  { key: 'F', i18nKey: 'favoriteAdd' },
  { key: '/', i18nKey: 'shortcutSearch' },
  { key: '?', i18nKey: 'keyboardShortcuts' },
  { key: 'Esc', i18nKey: 'close' },
  { key: 'Ctrl+K', i18nKey: 'cmdHint' },
] as const;

export default function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="bg-card border border-th-border-strong rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-[fadeSlideIn_0.2s_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-tx-primary">{t.keyboardShortcuts}</h2>
          </div>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-6 space-y-2">
          {SHORTCUTS.map(({ key, i18nKey }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-sm text-tx-secondary">
                {t[i18nKey as keyof typeof t]}
              </span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-medium bg-subtle border border-th-border rounded-lg text-tx-primary min-w-[2.5rem] text-center">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
