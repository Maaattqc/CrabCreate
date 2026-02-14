import { useEffect } from 'react';

interface ShortcutCallbacks {
  onNewTicket?: () => void;
  onSearch?: () => void;
  onNextTicket?: () => void;
  onPrevTicket?: () => void;
  onToggleFavorite?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(callbacks: ShortcutCallbacks, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      switch (e.key) {
        case 'n':
          e.preventDefault();
          callbacks.onNewTicket?.();
          break;
        case 'j':
          e.preventDefault();
          callbacks.onNextTicket?.();
          break;
        case 'k':
          e.preventDefault();
          callbacks.onPrevTicket?.();
          break;
        case 'f':
          e.preventDefault();
          callbacks.onToggleFavorite?.();
          break;
        case '/':
          e.preventDefault();
          callbacks.onSearch?.();
          break;
        case '?':
          e.preventDefault();
          callbacks.onShowShortcuts?.();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callbacks, enabled]);
}
