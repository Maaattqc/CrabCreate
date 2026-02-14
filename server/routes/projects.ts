import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db/sqlite';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { requireProject, requireProjectRole } from '../middleware/project';
import { checkProjectLimit, checkMemberLimit } from '../middleware/plan-limit';
import { hasMinRole } from '../permissions';
import {
  createProjectSchema,
  updateProjectSchema,
  inviteMemberSchema,
  changeMemberRoleSchema,
  transferOwnershipSchema,
} from '../schemas';
import { emitProjectUpdated } from '../socket';
import type { ProjectRole } from '../types';

const router = Router();

// ── Project CRUD ────────────────────────────────────────────────────────────

// GET /api/projects — list my projects
router.get('/', (req: Request, res: Response) => {
  const projects = repo.findProjectsByUserId(req.user!.userId);
  res.json(projects);
});

// POST /api/projects — create a project
router.post('/', validate(createProjectSchema), checkProjectLimit, (req: Request, res: Response) => {
  const { name, description, slug, is_private, default_repo } = req.body;
  const userId = req.user!.userId;

  // Check slug uniqueness for this user
  const existing = repo.findProjectByOwnerAndSlug(userId, slug);
  if (existing) {
    res.status(409).json({ error: 'Un projet avec ce slug existe déjà' });
    return;
  }

  const project = repo.createProject(name, description, slug, userId, is_private, default_repo);
  repo.insertAuditLog(userId, req.user!.email, 'project_create', 'project', project.id, name);
  res.status(201).json({ ...project, role: 'owner' as ProjectRole });
});

// GET /api/projects/:id — project details (requires membership)
router.get('/:id', requireProject, (req: Request, res: Response) => {
  const project = repo.findProjectById(req.project!.id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json({ ...project, role: req.project!.userRole });
});

// PUT /api/projects/:id — update project (admin+)
router.put('/:id', requireProject, requireProjectRole('admin'), validate(updateProjectSchema), (req: Request, res: Response) => {
  const updated = repo.updateProject(req.project!.id, req.body);
  if (!updated) { res.status(400).json({ error: 'No fields to update' }); return; }
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'project_update', 'project', req.project!.id, JSON.stringify(req.body));
  emitProjectUpdated(req.project!.id, req.body);
  res.json({ ...updated, role: req.project!.userRole });
});

// DELETE /api/projects/:id — delete project (owner only)
router.delete('/:id', requireProject, requireProjectRole('owner'), (req: Request, res: Response) => {
  repo.deleteProject(req.project!.id);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'project_delete', 'project', req.project!.id);
  res.json({ success: true });
});

// ── Members ─────────────────────────────────────────────────────────────────

// GET /api/projects/:id/members
router.get('/:id/members', requireProject, (req: Request, res: Response) => {
  const members = repo.findProjectMembers(req.project!.id);
  res.json(members);
});

// POST /api/projects/:id/invite — invite by email (admin+)
router.post('/:id/invite', requireProject, requireProjectRole('admin'), validate(inviteMemberSchema), checkMemberLimit, (req: Request, res: Response) => {
  const { email, role } = req.body;
  const projectId = req.project!.id;

  // Cannot invite as owner
  if (role === 'owner') {
    res.status(400).json({ error: 'Cannot invite as owner. Use transfer ownership.' });
    return;
  }

  // Check if user is already a member
  const existingUser = repo.findUserByEmail(email);
  if (existingUser) {
    const existingMember = repo.findProjectMember(projectId, existingUser.id);
    if (existingMember) {
      res.status(409).json({ error: 'Cet utilisateur est déjà membre du projet' });
      return;
    }
  }

  // Check if already invited
  const existingInvitation = repo.findExistingInvitation(projectId, email);
  if (existingInvitation) {
    res.status(409).json({ error: 'Une invitation est déjà en attente pour cet email' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const invitation = repo.createInvitation(projectId, email, role, req.user!.userId, token, expiresAt);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'project_invite', 'project', projectId, `${email} as ${role}`);
  res.status(201).json(invitation);
});

// PUT /api/projects/:id/members/:userId/role — change role
router.put('/:id/members/:userId/role', requireProject, validate(changeMemberRoleSchema), (req: Request, res: Response) => {
  const targetUserId = Number(req.params.userId);
  const { role: newRole } = req.body;
  const projectId = req.project!.id;
  const callerRole = req.project!.userRole;

  const targetMember = repo.findProjectMember(projectId, targetUserId);
  if (!targetMember) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Cannot change owner's role
  if (targetMember.role === 'owner') {
    res.status(403).json({ error: 'Cannot change owner role. Use transfer ownership.' });
    return;
  }

  // Only owner can promote to admin
  if (newRole === 'admin' && callerRole !== 'owner') {
    res.status(403).json({ error: 'Only the owner can promote to admin' });
    return;
  }

  // Admin can change member/viewer roles, but not other admins
  if (callerRole === 'admin' && targetMember.role === 'admin') {
    res.status(403).json({ error: 'Admins cannot change other admin roles' });
    return;
  }

  // Must be admin+ to change roles
  if (!hasMinRole(callerRole, 'admin')) {
    res.status(403).json({ error: 'Requires admin role or higher' });
    return;
  }

  repo.updateProjectMemberRole(projectId, targetUserId, newRole);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'project_role_change', 'project', projectId, `user ${targetUserId} → ${newRole}`);
  res.json({ success: true });
});

// DELETE /api/projects/:id/members/:userId — remove member (admin+)
router.delete('/:id/members/:userId', requireProject, requireProjectRole('admin'), (req: Request, res: Response) => {
  const targetUserId = Number(req.params.userId);
  const projectId = req.project!.id;

  const targetMember = repo.findProjectMember(projectId, targetUserId);
  if (!targetMember) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Cannot remove the owner
  if (targetMember.role === 'owner') {
    res.status(403).json({ error: 'Cannot remove the project owner' });
    return;
  }

  // Admin cannot remove other admins (only owner can)
  if (targetMember.role === 'admin' && req.project!.userRole !== 'owner') {
    res.status(403).json({ error: 'Only the owner can remove admins' });
    return;
  }

  repo.deleteProjectMember(projectId, targetUserId);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'project_member_remove', 'project', projectId, `user ${targetUserId}`);
  res.json({ success: true });
});

// POST /api/projects/:id/transfer-ownership — transfer ownership (owner only)
router.post('/:id/transfer-ownership', requireProject, requireProjectRole('owner'), validate(transferOwnershipSchema), (req: Request, res: Response) => {
  const { new_owner_id } = req.body;
  const projectId = req.project!.id;
  const currentOwnerId = req.user!.userId;

  if (new_owner_id === currentOwnerId) {
    res.status(400).json({ error: 'Already the owner' });
    return;
  }

  const newOwnerMember = repo.findProjectMember(projectId, new_owner_id);
  if (!newOwnerMember) {
    res.status(404).json({ error: 'Target user is not a member of this project' });
    return;
  }

  // Transfer: new owner gets 'owner', old owner becomes 'admin'
  repo.updateProjectMemberRole(projectId, new_owner_id, 'owner');
  repo.updateProjectMemberRole(projectId, currentOwnerId, 'admin');
  // Update project owner_id
  // Update owner_id
  db.prepare("UPDATE kanban_projects SET owner_id = ?, updated_at = datetime('now') WHERE id = ?").run(new_owner_id, projectId);

  repo.insertAuditLog(currentOwnerId, req.user!.email, 'project_transfer', 'project', projectId, `→ user ${new_owner_id}`);
  res.json({ success: true });
});

// ── Invitations (project-scoped) ────────────────────────────────────────────

// GET /api/projects/:id/invitations — view pending invitations (admin+)
router.get('/:id/invitations', requireProject, requireProjectRole('admin'), (req: Request, res: Response) => {
  const invitations = repo.findPendingInvitationsByProject(req.project!.id);
  res.json(invitations);
});

// DELETE /api/projects/:id/invitations/:invId — cancel invitation (admin+)
router.delete('/:id/invitations/:invId', requireProject, requireProjectRole('admin'), (req: Request, res: Response) => {
  const invId = Number(req.params.invId);
  repo.deleteInvitation(invId);
  res.json({ success: true });
});

export default router;
