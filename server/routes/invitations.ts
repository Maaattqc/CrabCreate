import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/invitations — my pending invitations
router.get('/', (req: Request, res: Response) => {
  const invitations = repo.findPendingInvitationsByEmail(req.user!.email);
  res.json(invitations);
});

// POST /api/invitations/:token/accept
router.post('/:token/accept', (req: Request, res: Response) => {
  const invitation = repo.findInvitationByToken(String(req.params.token));
  if (!invitation) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  if (invitation.status !== 'pending') {
    res.status(400).json({ error: 'Invitation already processed' });
    return;
  }
  if (new Date(invitation.expires_at) < new Date()) {
    repo.updateInvitationStatus(invitation.id, 'expired');
    res.status(410).json({ error: 'Invitation expired' });
    return;
  }
  // Verify the invitation is for this user's email
  if (invitation.email.toLowerCase() !== req.user!.email.toLowerCase()) {
    res.status(403).json({ error: 'This invitation is not for your email' });
    return;
  }

  // Check if already a member
  const existing = repo.findProjectMember(invitation.project_id, req.user!.userId);
  if (existing) {
    repo.updateInvitationStatus(invitation.id, 'accepted');
    res.json({ success: true, message: 'Already a member' });
    return;
  }

  // Check member limit based on project owner's plan
  const project = repo.findProjectById(invitation.project_id);
  if (project) {
    const owner = repo.findUserById(project.owner_id);
    if (owner && owner.is_admin !== 1) {
      const plan = owner.plan || 'free';
      const memberKeys: Record<string, string> = { free: 'plan_free_members', pro: 'plan_pro_members', enterprise: 'plan_enterprise_members' };
      const memberDefaults: Record<string, number> = { plan_free_members: 5, plan_pro_members: 20, plan_enterprise_members: -1 };
      const configKey = memberKeys[plan] || memberKeys.free;
      const val = repo.getConfig(configKey);
      const limit = val !== undefined ? parseInt(val, 10) : (memberDefaults[configKey] ?? -1);
      if (limit !== -1) {
        const count = repo.countProjectMembers(invitation.project_id);
        if (count >= limit) {
          res.status(403).json({ error: 'plan_limit_members' });
          return;
        }
      }
    }
  }

  // Add as member
  repo.insertProjectMember(invitation.project_id, req.user!.userId, invitation.role);
  repo.updateInvitationStatus(invitation.id, 'accepted');
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'project_join', 'project', invitation.project_id);
  res.json({ success: true });
});

// POST /api/invitations/:token/reject
router.post('/:token/reject', (req: Request, res: Response) => {
  const invitation = repo.findInvitationByToken(String(req.params.token));
  if (!invitation) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  if (invitation.status !== 'pending') {
    res.status(400).json({ error: 'Invitation already processed' });
    return;
  }
  if (invitation.email.toLowerCase() !== req.user!.email.toLowerCase()) {
    res.status(403).json({ error: 'This invitation is not for your email' });
    return;
  }

  repo.updateInvitationStatus(invitation.id, 'rejected');
  res.json({ success: true });
});

export default router;
