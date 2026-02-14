import { useState } from 'react';
import { X } from 'lucide-react';
import { AI_MODELS } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import type { Ticket } from '../../types';


interface CreateTicketModalProps {
  onClose: () => void;
  onCreate: (data: Partial<Ticket>) => Promise<Ticket>;
}

interface FormState {
  title: string;
  description: string;
  priority: string;
  template: string;
  ai_model: string;
  repo: string;
  assignee: string;
}

export default function CreateTicketModal({ onClose, onCreate }: CreateTicketModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    priority: 'medium',
    template: 'feature',
    ai_model: 'claude',
    repo: 'main-site',
    assignee: 'unassigned',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onCreate({
        ...form,
        target_files: [],
        tags: [],
        depends_on: [],
      } as unknown as Partial<Ticket>);
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('plan_limit')) {
        setError(`${t.billingPlanLimitTickets} ${t.billingUpgradePrompt}`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-modal-overlay backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-xl w-full max-w-md mx-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="text-base font-semibold text-tx-primary">{t.createTitle}</h2>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-tertiary"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-tx-muted mb-1">{t.titleLabel}</label>
            <input
              value={form.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, title: e.target.value }))}
              className={`w-full bg-subtle border rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50 ${form.title.length > 0 && form.title.length < 3 ? 'border-red-500/50' : 'border-th-border-strong'}`}
              placeholder={t.titlePlaceholder}
              required
              maxLength={200}
            />
            <div className="flex justify-between mt-1">
              <span className={`text-[11px] ${form.title.length > 0 && form.title.length < 3 ? 'text-red-400' : 'text-tx-faint'}`}>
                {t.validationTitleHint}
              </span>
              {form.title.length > 0 && (
                <span className={`text-[11px] ${form.title.length < 3 ? 'text-red-400' : 'text-tx-faint'}`}>
                  {form.title.length}/200
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-tx-muted mb-1">{t.descriptionLabel}</label>
            <textarea
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50 min-h-[80px] resize-y"
              placeholder={t.descriptionPlaceholder}
              maxLength={5000}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-tx-faint">{t.validationDescTicketHint}</span>
              {form.description.length > 100 && (
                <span className={`text-[11px] ${form.description.length > 4500 ? 'text-amber-400' : 'text-tx-faint'}`}>
                  {5000 - form.description.length} {t.validationCharsRemaining}
                </span>
              )}
            </div>
          </div>

          {/* AI Model */}
          <div>
            <label className="block text-xs text-tx-muted mb-1">{t.aiModelLabel}</label>
            <select
              value={form.ai_model}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, ai_model: e.target.value }))}
              className="w-full bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
            >
              {AI_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-tx-muted hover:text-tx-secondary transition-colors">
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || form.title.trim().length < 3}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-medium rounded-lg hover:from-amber-400 hover:to-red-400 transition-all disabled:opacity-50"
            >
              {loading ? t.creating : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
