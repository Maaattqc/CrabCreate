import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { getSettings, updateSettings } from '../../api/tickets';
import { useLanguage } from '../../hooks/useLanguage';
import { useAnimations } from '../../hooks/useAnimations';
import { useAIDesign } from '../../hooks/useAIDesign';
import type { Lang } from '../../i18n';

interface SettingsModalProps {
  onClose: () => void;
  showMascot: boolean;
  onToggleMascot: (v: boolean) => void;
}

interface SettingsRow {
  key: string;
  labelKey: 'maxPipelines' | 'maxRequests' | 'maxTickets';
  descKey: 'maxPipelinesDesc' | 'maxRequestsDesc' | 'maxTicketsDesc';
  defaultValue: number;
}

const SETTINGS_ROWS: SettingsRow[] = [
  { key: 'max_concurrent_pipelines', labelKey: 'maxPipelines', descKey: 'maxPipelinesDesc', defaultValue: 2 },
  { key: 'requests_per_minute', labelKey: 'maxRequests', descKey: 'maxRequestsDesc', defaultValue: 60 },
  { key: 'tickets_per_hour', labelKey: 'maxTickets', descKey: 'maxTicketsDesc', defaultValue: 20 },
];

export default function SettingsModal({ onClose, showMascot, onToggleMascot }: SettingsModalProps) {
  const { lang, setLang, t } = useLanguage();
  const { animations, setAnimations } = useAnimations();
  const { aiDesign, setAIDesign } = useAIDesign();
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(SETTINGS_ROWS.map(r => [r.key, r.defaultValue]))
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSettings()
      .then(data => setValues(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSettings(values);
      onClose();
    } catch (err) {
      console.error('Settings update error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-overlay backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-xl w-full max-w-md mx-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-amber-400" />
            <h2 className="text-base font-semibold text-tx-primary font-display">{t.settingsTitle}</h2>
          </div>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-tertiary"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {SETTINGS_ROWS.map(row => (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label className="block text-sm text-tx-primary">{t[row.labelKey]}</label>
                <span className="block text-xs text-tx-faint">{t[row.descKey]}</span>
              </div>
              <input
                type="number"
                min={1}
                value={values[row.key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setValues(v => ({ ...v, [row.key]: parseInt(e.target.value) || 0 }))
                }
                className="w-20 bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary font-mono text-center focus:outline-none focus:border-amber-500/50"
              />
            </div>
          ))}

          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">{t.language}</label>
            <p className="text-xs text-tx-faint mb-2">{t.languageDesc}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${lang === 'fr' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${lang === 'en' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                English
              </button>
            </div>
          </div>

          {/* Animations toggle */}
          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">{t.animations}</label>
            <p className="text-xs text-tx-faint mb-2">{t.animationsDesc}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAnimations(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${animations ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                {t.animationsOn}
              </button>
              <button
                type="button"
                onClick={() => setAnimations(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!animations ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                {t.animationsOff}
              </button>
            </div>
          </div>

          {/* AI Design toggle */}
          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">{t.aiDesign}</label>
            <p className="text-xs text-tx-faint mb-2">{t.aiDesignDesc}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAIDesign(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aiDesign ? 'bg-gradient-to-r from-amber-500/20 to-red-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                {t.aiDesignOn}
              </button>
              <button
                type="button"
                onClick={() => setAIDesign(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!aiDesign ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                {t.aiDesignOff}
              </button>
            </div>
          </div>

          {/* Mascot toggle */}
          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">{t.mascot}</label>
            <p className="text-xs text-tx-faint mb-2">{t.mascotDesc}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onToggleMascot(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showMascot ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                {t.mascotOn}
              </button>
              <button
                type="button"
                onClick={() => onToggleMascot(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!showMascot ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-subtle text-tx-faint hover:text-tx-tertiary border border-th-border'}`}
              >
                {t.mascotOff}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-tx-muted hover:text-tx-secondary transition-colors">
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium rounded-lg hover:from-amber-400 hover:to-red-400 transition-all disabled:opacity-50"
            >
              {loading ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
