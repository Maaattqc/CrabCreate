import { Mic } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface MicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  className?: string;
  size?: number;
}

export default function MicButton({ isListening, isSupported, onClick, className = '', size = 16 }: MicButtonProps) {
  const { t } = useLanguage();

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={isListening ? t.micStop : t.micStart}
      className={`p-1 rounded transition-colors ${
        isListening
          ? 'text-red-400 bg-red-500/15 mic-recording'
          : 'text-tx-faint hover:text-amber-400'
      } ${className}`}
    >
      <Mic size={size} />
    </button>
  );
}
