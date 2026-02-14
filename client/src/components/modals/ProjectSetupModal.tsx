import { useState } from 'react';
import { X, Github, GitBranch, Cloud, ChevronRight, Check, Loader2, Plus, Link } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { connectRepo, createNewRepo, configureDeploy, skipDeploy } from '../../api/project-setup';
import type { GitProviderType } from '../../types';

interface ProjectSetupModalProps {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'repo' | 'deploy';
type RepoMode = 'connect' | 'create' | null;

const PROVIDERS: { id: GitProviderType; label: string; icon: React.ReactNode }[] = [
  { id: 'github', label: 'GitHub', icon: <Github size={18} /> },
  { id: 'gitlab', label: 'GitLab', icon: <GitBranch size={18} /> },
  { id: 'bitbucket', label: 'Bitbucket', icon: <GitBranch size={18} /> },
];

export default function ProjectSetupModal({ onClose, onComplete }: ProjectSetupModalProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('repo');
  const [repoMode, setRepoMode] = useState<RepoMode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Connect repo fields
  const [provider, setProvider] = useState<GitProviderType>('github');
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('main');

  // Create repo fields
  const [newRepoName, setNewRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  const handleConnectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await connectRepo({ provider, owner, repo: repoName, token, branch });
      setStep('deploy');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await createNewRepo({ provider, token, repoName: newRepoName, isPrivate });
      setStep('deploy');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureDeploy = async () => {
    setLoading(true);
    setError('');
    try {
      await configureDeploy();
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipDeploy = async () => {
    setLoading(true);
    try {
      await skipDeploy();
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-th-border-strong rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-[fadeSlideIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-tx-primary">{t.setupTitle}</h2>
            <div className="flex items-center gap-1.5 text-xs text-tx-faint">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ${step === 'repo' ? 'bg-amber-500 text-white' : 'bg-green-500/20 text-green-400'}`}>
                {step === 'deploy' ? <Check size={12} /> : '1'}
              </span>
              <ChevronRight size={12} />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ${step === 'deploy' ? 'bg-amber-500 text-white' : 'bg-subtle text-tx-faint'}`}>
                2
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-secondary"><X size={18} /></button>
        </div>

        <div className="p-6">
          {/* Step 1: Repo */}
          {step === 'repo' && (
            <div className="space-y-4">
              <p className="text-sm text-tx-secondary">{t.setupRepoDesc}</p>

              {/* Mode selection */}
              {!repoMode && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRepoMode('connect')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-th-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
                  >
                    <Link size={24} className="text-amber-400" />
                    <span className="text-sm font-medium text-tx-primary">{t.setupConnectExisting}</span>
                    <span className="text-[11px] text-tx-faint text-center">{t.setupConnectExistingDesc}</span>
                  </button>
                  <button
                    onClick={() => setRepoMode('create')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-th-border hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
                  >
                    <Plus size={24} className="text-amber-400" />
                    <span className="text-sm font-medium text-tx-primary">{t.setupCreateNew}</span>
                    <span className="text-[11px] text-tx-faint text-center">{t.setupCreateNewDesc}</span>
                  </button>
                </div>
              )}

              {/* Provider select (shared) */}
              {repoMode && (
                <div className="space-y-3">
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
                    />
                  </div>
                </div>
              )}

              {/* Connect existing repo form */}
              {repoMode === 'connect' && (
                <form onSubmit={handleConnectRepo} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
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

                  <div>
                    <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupBranch}</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={e => setBranch(e.target.value)}
                      className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => { setRepoMode(null); setError(''); }} className="flex-1 py-2.5 rounded-lg border border-th-border text-sm text-tx-faint hover:bg-subtle-hover transition-colors">
                      {t.setupBack}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !token || !owner || !repoName}
                      className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      {t.setupConnect}
                    </button>
                  </div>
                </form>
              )}

              {/* Create new repo form */}
              {repoMode === 'create' && (
                <form onSubmit={handleCreateRepo} className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-tx-secondary block mb-1">{t.setupRepoName}</label>
                    <input
                      type="text"
                      value={newRepoName}
                      onChange={e => setNewRepoName(e.target.value)}
                      placeholder="my-new-app"
                      className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrivate(true)}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${isPrivate ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-th-border text-tx-faint hover:border-th-border-strong'}`}
                    >
                      {t.setupPrivate}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPrivate(false)}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${!isPrivate ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-th-border text-tx-faint hover:border-th-border-strong'}`}
                    >
                      {t.setupPublic}
                    </button>
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => { setRepoMode(null); setError(''); }} className="flex-1 py-2.5 rounded-lg border border-th-border text-sm text-tx-faint hover:bg-subtle-hover transition-colors">
                      {t.setupBack}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !token || !newRepoName}
                      className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      {t.setupCreateRepo}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Step 2: Deploy */}
          {step === 'deploy' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Check size={16} />
                <span>{t.setupRepoSuccess}</span>
              </div>

              <p className="text-sm text-tx-secondary">{t.setupDeployDesc}</p>

              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-subtle border border-th-border">
                  <Cloud size={18} className="text-orange-400" />
                  <span className="text-sm font-medium text-tx-primary">Cloudflare Pages</span>
                </div>

                <p className="text-[11px] text-tx-faint">{t.setupCfInfo}</p>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSkipDeploy}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg border border-th-border text-sm text-tx-faint hover:bg-subtle-hover transition-colors"
                  >
                    {t.setupSkipDeploy}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfigureDeploy}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {t.setupConfigureDeploy}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
