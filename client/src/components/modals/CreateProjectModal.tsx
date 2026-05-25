import { useState } from 'react';
import { X, Lock, Users, Link, FolderPlus, Github, GitBranch, Loader2, ArrowLeft, Check, XCircle, Wifi } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';
import { connectRepo, testConnection } from '../../api/project-setup';
import VoiceInput from '../common/VoiceInput';
import VoiceTextarea from '../common/VoiceTextarea';
import type { GitProviderType } from '../../types';

interface CreateProjectModalProps {
  onClose: () => void;
}

type ProjectMode = 'connect' | 'new' | null;

const PROVIDERS: { id: GitProviderType; label: string; icon: React.ReactNode }[] = [
  { id: 'github', label: 'GitHub', icon: <Github size={18} /> },
  { id: 'gitlab', label: 'GitLab', icon: <GitBranch size={18} /> },
  { id: 'bitbucket', label: 'Bitbucket', icon: <GitBranch size={18} /> },
];

export default function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const { t } = useLanguage();
  const { createProject } = useProject();
  const [mode, setMode] = useState<ProjectMode>(null);

  // Project fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Git connection fields (only for 'connect' mode)
  const [provider, setProvider] = useState<GitProviderType>('github');
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('master');
  const [targetBranch, setTargetBranch] = useState('develop');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await testConnection({ provider, token, owner, repo: repoName });
      setTestResult(res.success ? 'success' : 'fail');
      if (!res.success && res.error) setError(res.error);
    } catch (err) {
      setTestResult('fail');
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const autoSlug = (value: string) => {
    setName(value);
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
      const result = await createProject({
        name: name.trim(),
        slug,
        description: description.trim(),
        is_private: isPrivate ? 1 : 0,
        auto_repo: mode === 'new', // auto-create GitHub repo when creating new project
      });

      // If connect mode, also connect the repo to the newly created project
      if (mode === 'connect') {
        try {
          await connectRepo({ provider, owner, repo: repoName, token, branch, target_branch: targetBranch });
        } catch (err) {
          // Project created but repo connection failed — still close, user can retry in settings
          console.warn('Repo connection failed after project creation:', (err as Error).message);
        }
      }

      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg === 'plan_limit_projects' ? t.billingPlanLimitProjects : msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = mode === 'connect'
    ? name.trim() && slug.trim() && token && owner && repoName
    : name.trim() && slug.trim();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 animate-[fadeSlideIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-th-border">
          <div className="flex items-center gap-2">
            {mode && (
              <button onClick={() => { setMode(null); setError(''); }} className="text-tx-faint hover:text-tx-secondary">
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-tx-primary">{t.projectCreate}</h2>
          </div>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-secondary"><X size={18} /></button>
        </div>

        {/* Step 1: Choice screen */}
        {!mode && (
          <div className="p-4 sm:p-6 space-y-3">
            <button
              onClick={() => setMode('new')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-th-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <FolderPlus size={22} className="text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-tx-primary block">{t.projectNewComplete}</span>
                <span className="text-[12px] text-tx-faint">{t.projectNewCompleteDesc}</span>
              </div>
            </button>

            <button
              onClick={() => setMode('connect')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-th-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <Link size={22} className="text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-tx-primary block">{t.projectConnectRepo}</span>
                <span className="text-[12px] text-tx-faint">{t.projectConnectRepoDesc}</span>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Project form (+ git fields if connect mode) */}
        {mode && (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Git connection fields — only in connect mode */}
            {mode === 'connect' && (
              <>
                <div>
                  <label className="text-sm font-medium text-tx-secondary block mb-1.5">{t.setupProvider}</label>
                  <div className="flex gap-2">
                    {PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProvider(p.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-colors ${
                          provider === p.id
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                            : 'border-th-border text-tx-faint hover:border-th-border-strong'
                        }`}
                      >
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupToken}</label>
                  <input
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="ghp_xxxx... / glpat-xxxx..."
                    className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupOwner}</label>
                    <input
                      type="text"
                      value={owner}
                      onChange={e => setOwner(e.target.value)}
                      placeholder="my-org"
                      className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupRepoName}</label>
                    <input
                      type="text"
                      value={repoName}
                      onChange={e => setRepoName(e.target.value)}
                      placeholder="my-app"
                      className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupSourceBranch}</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={e => setBranch(e.target.value)}
                      className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupTargetBranch}</label>
                    <input
                      type="text"
                      value={targetBranch}
                      onChange={e => setTargetBranch(e.target.value)}
                      className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !token || !provider}
                  className="w-full py-2 rounded-lg border border-th-border text-sm text-tx-secondary hover:bg-subtle-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testing ? (
                    <><Loader2 size={14} className="animate-spin" /> {t.setupTesting}</>
                  ) : testResult === 'success' ? (
                    <><Check size={14} className="text-green-400" /> <span className="text-green-400">{t.setupTestConnectionSuccess}</span></>
                  ) : testResult === 'fail' ? (
                    <><XCircle size={14} className="text-red-400" /> <span className="text-red-400">{t.setupTestConnectionFail}</span></>
                  ) : (
                    <><Wifi size={14} /> {t.setupTestConnection}</>
                  )}
                </button>

                <div className="border-t border-th-border" />
              </>
            )}

            {/* Project details */}
            <div>
              <label className="text-sm font-medium text-tx-secondary block mb-1">{t.projectName} *</label>
              <VoiceInput
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
              <VoiceTextarea
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
                disabled={loading || !canSubmit}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? t.creating : t.create}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
