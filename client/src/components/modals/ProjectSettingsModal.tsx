import { useState, useEffect } from 'react';
import { X, Trash2, UserPlus, Crown, Shield, Eye, UserMinus } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';
import * as projectsApi from '../../api/projects';
import WebhooksPanel from './WebhooksPanel';
import type { ProjectMember, ProjectInvitation, ProjectRole } from '../../types';

interface ProjectSettingsModalProps {
  onClose: () => void;
}

const ROLE_ICONS: Record<ProjectRole, typeof Crown> = { owner: Crown, admin: Shield, member: UserPlus, viewer: Eye };
const ROLE_COLORS: Record<ProjectRole, string> = { owner: 'text-amber-400', admin: 'text-purple-400', member: 'text-blue-400', viewer: 'text-tx-faint' };

export default function ProjectSettingsModal({ onClose }: ProjectSettingsModalProps) {
  const { t } = useLanguage();
  const { currentProject, updateProject, deleteProject } = useProject();
  const [tab, setTab] = useState<'general' | 'members' | 'webhooks' | 'danger'>('general');

  // General
  const [name, setName] = useState(currentProject?.name || '');
  const [description, setDescription] = useState(currentProject?.description || '');
  const [isPrivate, setIsPrivate] = useState(currentProject?.is_private === 1);
  const [cursorsEnabled, setCursorsEnabled] = useState(currentProject?.cursors_enabled !== 0);
  const [presenceEnabled, setPresenceEnabled] = useState(currentProject?.presence_enabled !== 0);
  const [presenceMaxVisible, setPresenceMaxVisible] = useState(currentProject?.presence_max_visible ?? 5);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);

  // Members
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [pendingInvitations, setPendingInvitations] = useState<ProjectInvitation[]>([]);
  const [inviting, setInviting] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Danger
  const [confirmDelete, setConfirmDelete] = useState('');
  const [transferTarget, setTransferTarget] = useState<number | null>(null);

  const projectId = currentProject?.id;
  const isOwner = currentProject?.role === 'owner';
  const isAdmin = currentProject?.role === 'admin' || isOwner;

  useEffect(() => {
    if (!projectId) return;
    projectsApi.getProjectMembers(projectId).then(setMembers).catch(() => {});
    projectsApi.getProjectInvitations(projectId).then(setPendingInvitations).catch(() => {});
  }, [projectId]);

  const handleSaveGeneral = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveResult(null);
    try {
      await updateProject(projectId, {
        name,
        description,
        is_private: isPrivate ? 1 : 0,
        cursors_enabled: cursorsEnabled ? 1 : 0,
        presence_enabled: presenceEnabled ? 1 : 0,
        presence_max_visible: presenceMaxVisible,
      });
      setSaveResult('success');
      setTimeout(() => onClose(), 600);
    } catch {
      setSaveResult('error');
    }
    setSaving(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !inviteEmail.trim()) return;
    setInviting(true);
    setMemberError('');
    try {
      await projectsApi.inviteMember(projectId, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      const inv = await projectsApi.getProjectInvitations(projectId);
      setPendingInvitations(inv);
    } catch (err) {
      const msg = (err as Error).message;
      setMemberError(msg === 'plan_limit_members' ? t.billingPlanLimitMembers : msg);
    }
    setInviting(false);
  };

  const handleChangeRole = async (userId: number, role: string) => {
    if (!projectId) return;
    try {
      await projectsApi.changeMemberRole(projectId, userId, role);
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: role as ProjectRole } : m));
    } catch (err) {
      setMemberError((err as Error).message);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!projectId) return;
    try {
      await projectsApi.removeMember(projectId, userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (err) {
      setMemberError((err as Error).message);
    }
  };

  const handleCancelInvitation = async (invId: number) => {
    if (!projectId) return;
    try {
      await projectsApi.cancelInvitation(projectId, invId);
      setPendingInvitations(prev => prev.filter(i => i.id !== invId));
    } catch { /* ignore */ }
  };

  const handleDeleteProject = async () => {
    if (!projectId || confirmDelete !== currentProject?.name) return;
    await deleteProject(projectId);
    onClose();
  };

  const handleTransfer = async () => {
    if (!projectId || !transferTarget) return;
    try {
      await projectsApi.transferOwnership(projectId, transferTarget);
      onClose();
    } catch (err) {
      setMemberError((err as Error).message);
    }
  };

  const roleLabel = (role: ProjectRole) => {
    const map: Record<ProjectRole, string> = { owner: t.projectRoleOwner, admin: t.projectRoleAdmin, member: t.projectRoleMember, viewer: t.projectRoleViewer };
    return map[role];
  };

  if (!currentProject) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-th-border-strong rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col animate-[fadeSlideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="text-lg font-semibold text-tx-primary">{t.projectSettings}</h2>
          <button onClick={onClose} className="text-tx-faint hover:text-tx-secondary"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-th-border px-6">
          {(['general', 'members', ...(isAdmin ? ['webhooks'] as const : []), 'danger'] as const).map(tb => (
            <button
              key={tb}
              onClick={() => setTab(tb as typeof tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === tb ? 'border-amber-500 text-amber-400' : 'border-transparent text-tx-faint hover:text-tx-secondary'}`}
            >
              {tb === 'general' ? t.projectGeneral : tb === 'members' ? t.projectMembers : tb === 'webhooks' ? t.webhooks : t.projectDangerZone}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* General tab */}
          {tab === 'general' && (
            <>
              <div>
                <label className="text-sm font-medium text-tx-secondary block mb-1">{t.projectName}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={`w-full bg-subtle border rounded-lg px-3 py-2 text-sm text-tx-primary focus:outline-none focus:border-amber-500/50 ${name.length > 0 && name.length < 2 ? 'border-red-500/50' : 'border-th-border'}`}
                  disabled={!isAdmin}
                  maxLength={100}
                />
                <span className={`text-[11px] mt-1 block ${name.length > 0 && name.length < 2 ? 'text-red-400' : 'text-tx-faint'}`}>
                  {t.validationProjectNameHint}
                </span>
              </div>
              <div>
                <label className="text-sm font-medium text-tx-secondary block mb-1">{t.projectDescription}</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary focus:outline-none focus:border-amber-500/50 resize-none"
                  disabled={!isAdmin}
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-tx-secondary">{t.projectCollaborative}</span>
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  disabled={!isAdmin}
                  className={`w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${!isPrivate ? 'bg-green-500' : 'bg-tx-ghost'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200 ${!isPrivate ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'}`} />
                </button>
              </div>

              {/* Collaboration section — only for collaborative projects */}
              {!isPrivate && (
                <div className="pt-3 border-t border-th-border space-y-3">
                  <h3 className="text-xs font-semibold text-tx-faint uppercase tracking-wider">{t.projectCollaboration}</h3>

                  {/* Cursors toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-tx-secondary block">{t.projectCursorsEnabled}</span>
                      <span className="text-[11px] text-tx-faint">{t.projectCursorsEnabledDesc}</span>
                    </div>
                    <button
                      onClick={() => setCursorsEnabled(!cursorsEnabled)}
                      disabled={!isAdmin}
                      className={`w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${cursorsEnabled ? 'bg-green-500' : 'bg-tx-ghost'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200 ${cursorsEnabled ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'}`} />
                    </button>
                  </div>

                  {/* Presence toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-tx-secondary block">{t.projectPresenceEnabled}</span>
                      <span className="text-[11px] text-tx-faint">{t.projectPresenceEnabledDesc}</span>
                    </div>
                    <button
                      onClick={() => setPresenceEnabled(!presenceEnabled)}
                      disabled={!isAdmin}
                      className={`w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 ${presenceEnabled ? 'bg-green-500' : 'bg-tx-ghost'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200 ${presenceEnabled ? 'translate-x-4 bg-white' : 'translate-x-0 bg-gray-300'}`} />
                    </button>
                  </div>

                  {/* Max visible avatars */}
                  {presenceEnabled && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-tx-secondary block">{t.projectPresenceMax}</span>
                        <span className="text-[11px] text-tx-faint">{t.projectPresenceMaxDesc}</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={presenceMaxVisible}
                        onChange={e => setPresenceMaxVisible(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                        disabled={!isAdmin}
                        className="w-16 bg-subtle border border-th-border rounded-lg px-2 py-1 text-sm text-tx-primary text-center focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  )}
                </div>
              )}

              {isAdmin && (
                <>
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving || saveResult === 'success'}
                    className={`w-full py-2.5 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 ${saveResult === 'success' ? 'bg-green-500' : saveResult === 'error' ? 'bg-red-500 hover:opacity-90' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90'}`}
                  >
                    {saving ? t.saving : saveResult === 'success' ? t.savedOk : saveResult === 'error' ? t.error : t.save}
                  </button>
                  {saveResult === 'error' && (
                    <p className="text-xs text-red-400 text-center mt-1">{t.error}</p>
                  )}
                </>
              )}
            </>
          )}

          {/* Members tab */}
          {tab === 'members' && (
            <>
              {/* Invite form */}
              {isAdmin && (
                <form onSubmit={handleInvite} className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder={t.projectInviteEmail}
                    className="flex-1 bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50"
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                    className="bg-subtle border border-th-border rounded-lg px-2 py-2 text-sm text-tx-secondary"
                  >
                    {isOwner && <option value="admin">Admin</option>}
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                  >
                    <UserPlus size={16} />
                  </button>
                </form>
              )}

              {memberError && <p className="text-sm text-red-400">{memberError}</p>}

              {/* Members list */}
              <div className="space-y-1">
                {members.map(member => {
                  const RoleIcon = ROLE_ICONS[member.role];
                  return (
                    <div key={member.user_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-subtle-hover">
                      <div className="flex items-center gap-3 min-w-0">
                        <RoleIcon size={14} className={`${ROLE_COLORS[member.role]} shrink-0`} />
                        <span className="text-sm text-tx-primary truncate">{member.email}</span>
                        <span className="text-xs text-tx-faint bg-subtle px-2 py-0.5 rounded w-24 text-center shrink-0">{roleLabel(member.role)}</span>
                      </div>
                      {isAdmin && member.role !== 'owner' && (
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <select
                            value={member.role}
                            onChange={e => handleChangeRole(member.user_id, e.target.value)}
                            className="bg-subtle border border-th-border rounded px-1.5 py-1 text-xs text-tx-secondary"
                          >
                            {isOwner && <option value="admin">Admin</option>}
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <UserMinus size={13} />
                            <span>{t.projectRemoveMember}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pending invitations */}
              {pendingInvitations.length > 0 && (
                <>
                  <div className="text-xs font-medium text-tx-faint uppercase tracking-wider pt-2">{t.projectInvitations}</div>
                  <div className="space-y-1">
                    {pendingInvitations.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-subtle">
                        <div>
                          <span className="text-sm text-tx-secondary">{inv.email}</span>
                          <span className="text-xs text-tx-faint ml-2">({inv.role})</span>
                        </div>
                        <button
                          onClick={() => handleCancelInvitation(inv.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Webhooks tab */}
          {tab === 'webhooks' && currentProject && isAdmin && (
            <WebhooksPanel projectId={currentProject.id} />
          )}

          {/* Danger zone tab */}
          {tab === 'danger' && isOwner && (
            <>
              {/* Transfer ownership */}
              <div className="border border-amber-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-amber-400">{t.projectTransferOwnership}</h3>
                <select
                  value={transferTarget || ''}
                  onChange={e => setTransferTarget(Number(e.target.value) || null)}
                  className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-secondary"
                >
                  <option value="">--</option>
                  {members.filter(m => m.role !== 'owner').map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.email}</option>
                  ))}
                </select>
                <button
                  onClick={handleTransfer}
                  disabled={!transferTarget}
                  className="w-full py-2 rounded-lg border border-amber-500/50 text-amber-400 text-sm hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                >
                  {t.projectTransferOwnership}
                </button>
              </div>

              {/* Delete project */}
              <div className="border border-red-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-red-400">{t.projectDelete}</h3>
                <p className="text-xs text-tx-faint">{t.projectDeleteConfirm}</p>
                <input
                  type="text"
                  value={confirmDelete}
                  onChange={e => setConfirmDelete(e.target.value)}
                  placeholder={currentProject?.name}
                  className="w-full bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-red-500/50"
                />
                <button
                  onClick={handleDeleteProject}
                  disabled={confirmDelete !== currentProject?.name}
                  className="w-full py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> {t.projectDelete}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
