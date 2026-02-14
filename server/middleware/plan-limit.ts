import { Request, Response, NextFunction } from 'express';
import * as repo from '../db/repositories';

const PLAN_TICKET_KEYS: Record<string, string> = {
  free: 'plan_free_tickets',
  pro: 'plan_pro_tickets',
  enterprise: 'plan_enterprise_tickets',
};

const PLAN_PIPELINE_KEYS: Record<string, string> = {
  free: 'plan_free_pipelines',
  pro: 'plan_pro_pipelines',
  enterprise: 'plan_enterprise_pipelines',
};

const PLAN_TICKET_DEFAULTS: Record<string, number> = {
  plan_free_tickets: 5,
  plan_pro_tickets: 50,
  plan_enterprise_tickets: -1,
};

const PLAN_PIPELINE_DEFAULTS: Record<string, number> = {
  plan_free_pipelines: 1,
  plan_pro_pipelines: 3,
  plan_enterprise_pipelines: 10,
};

function getLimit(configKey: string, defaults: Record<string, number>): number {
  const val = repo.getConfig(configKey);
  return val !== undefined ? parseInt(val, 10) : (defaults[configKey] ?? -1);
}

export function checkTicketLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.userId;
  const user = repo.findUserById(userId);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  // Admins bypass all limits
  if (user.is_admin === 1) { next(); return; }

  const plan = user.plan || 'free';
  const configKey = PLAN_TICKET_KEYS[plan] || PLAN_TICKET_KEYS.free;
  const limit = getLimit(configKey, PLAN_TICKET_DEFAULTS);

  // -1 means unlimited
  if (limit === -1) { next(); return; }

  const projectId = req.project!.id;
  const count = repo.countUserTicketsThisMonth(userId, projectId);
  if (count >= limit) {
    res.status(403).json({ error: 'plan_limit_tickets' });
    return;
  }

  next();
}

const PLAN_PROJECT_KEYS: Record<string, string> = {
  free: 'plan_free_projects',
  pro: 'plan_pro_projects',
  enterprise: 'plan_enterprise_projects',
};

const PLAN_MEMBER_KEYS: Record<string, string> = {
  free: 'plan_free_members',
  pro: 'plan_pro_members',
  enterprise: 'plan_enterprise_members',
};

const PLAN_PROJECT_DEFAULTS: Record<string, number> = {
  plan_free_projects: 3,
  plan_pro_projects: 20,
  plan_enterprise_projects: -1,
};

const PLAN_MEMBER_DEFAULTS: Record<string, number> = {
  plan_free_members: 5,
  plan_pro_members: 20,
  plan_enterprise_members: -1,
};

export function checkProjectLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.userId;
  const user = repo.findUserById(userId);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  if (user.is_admin === 1) { next(); return; }

  const plan = user.plan || 'free';
  const configKey = PLAN_PROJECT_KEYS[plan] || PLAN_PROJECT_KEYS.free;
  const limit = getLimit(configKey, PLAN_PROJECT_DEFAULTS);

  if (limit === -1) { next(); return; }

  const count = repo.countUserOwnedProjects(userId);
  if (count >= limit) {
    res.status(403).json({ error: 'plan_limit_projects' });
    return;
  }

  next();
}

export function checkMemberLimit(req: Request, res: Response, next: NextFunction): void {
  const projectId = req.project!.id;
  const project = repo.findProjectById(projectId);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const owner = repo.findUserById(project.owner_id);
  if (!owner) { res.status(500).json({ error: 'Owner not found' }); return; }

  // Admins bypass all limits
  if (owner.is_admin === 1) { next(); return; }

  const plan = owner.plan || 'free';
  const configKey = PLAN_MEMBER_KEYS[plan] || PLAN_MEMBER_KEYS.free;
  const limit = getLimit(configKey, PLAN_MEMBER_DEFAULTS);

  if (limit === -1) { next(); return; }

  const count = repo.countProjectMembers(projectId);
  if (count >= limit) {
    res.status(403).json({ error: 'plan_limit_members' });
    return;
  }

  next();
}

export function checkPipelineLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.userId;
  const user = repo.findUserById(userId);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  // Admins bypass all limits
  if (user.is_admin === 1) { next(); return; }

  const plan = user.plan || 'free';
  const configKey = PLAN_PIPELINE_KEYS[plan] || PLAN_PIPELINE_KEYS.free;
  const limit = getLimit(configKey, PLAN_PIPELINE_DEFAULTS);

  // -1 means unlimited
  if (limit === -1) { next(); return; }

  const projectId = req.project!.id;
  const count = repo.countUserActivePipelines(userId, projectId);
  if (count >= limit) {
    res.status(403).json({ error: 'plan_limit_pipelines' });
    return;
  }

  next();
}
