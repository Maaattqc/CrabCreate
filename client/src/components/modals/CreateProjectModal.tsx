import { useState } from 'react';
import { X, Lock, Users } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';

interface CreateProjectModalProps {
  onClose: () => void;
}

export default function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const { t } = useLanguage();
  const { createProject } = useProject();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const autoSlug = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    const generated = value
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createProject({ name: name.trim(), slug, description: description.trim(), is_private: isPrivate ? 1 : 0 });
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg === 'plan_limit_projects' ? t.billingPlanLimitProjects : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-[fadeSlideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-tx-primary">{t.projectCreate}</h2>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-secondary"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-tx-secondary block mb-1">{t.projectName} *</label>
            <input
              type="text"
              value={name}
              onChange={e => autoSlug(e.target.value)}
              placeholder="Mon super projet"
              className={`w-full bg-subtle border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 ${name.length > 0 && name.length < 2 ? 'border-red-500/50' : 'border-th-border'}`}
              required
              maxLength={100}
            />
            <div className="flex justify-between mt-1">
              <span className={`text-[11px] ${name.length > 0 && name.length < 2 ? 'text-red-400' : 'text-tx-faint'}`}>
                {t.validationProjectNameHint}
              </span>
              {name.length > 0 && (
                <span className="text-[11px] text-tx-faint">{name.length}/100</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-tx-secondary block mb-1">{t.projectSlug} *</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="mon-super-projet"
              className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 font-mono"
              required
              maxLength={60}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            />
            <span className="text-[11px] text-tx-faint mt-1 block">{t.validationSlugHint}</span>
          </div>

          <div>
            <label className="text-sm font-medium text-tx-secondary block mb-1">{t.projectDescription}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 resize-none"
              maxLength={500}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-tx-faint">{t.validationDescProjectHint}</span>
              {description.length > 50 && (
                <span className={`text-[11px] ${description.length > 450 ? 'text-amber-400' : 'text-tx-faint'}`}>
                  {500 - description.length} {t.validationCharsRemaining}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-tx-secondary block mb-2">{t.projectPrivate} / {t.projectCollaborative}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-colors ${isPrivate ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-th-border text-tx-faint hover:border-th-border-strong'}`}
              >
                <Lock size={14} /> {t.projectPrivate}
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm transition-colors ${!isPrivate ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-th-border text-tx-faint hover:border-th-border-strong'}`}
              >
                <Users size={14} /> {t.projectCollaborative}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-th-border text-sm text-tx-faint hover:bg-subtle-hover transition-colors">
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !slug.trim()}
              className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? t.creating : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
