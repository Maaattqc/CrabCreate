import { Request, Response, NextFunction } from 'express';
import * as repo from '../db/repositories';
import { hasMinRole } from '../permissions';
import type { ProjectRole } from '../types';
import type { ProjectContext } from './auth';

/**
 * Reads X-Project-Id header, verifies the user is a member,
 * and attaches req.project with the user's role in that project.
 * Global admins (is_admin=1) get access with role 'admin'.
 */
export function requireProject(req: Request, res: Response, next: NextFunction): void {
  const projectIdHeader = req.headers['x-project-id'];
  if (!projectIdHeader) {
    res.status(400).json({ error: 'X-Project-Id header required' });
    return;
  }

  const projectId = Number(projectIdHeader);
  if (isNaN(projectId) || projectId <= 0) {
    res.status(400).json({ error: 'Invalid X-Project-Id' });
    return;
  }

  const project = repo.findProjectById(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const userId = req.user!.userId;

  // Check membership
  const member = repo.findProjectMember(projectId, userId);
  let userRole: ProjectRole;

  if (member) {
    userRole = member.role;
  } else {
    // Global admins bypass membership check
    const user = repo.findUserById(userId);
    if (user && user.is_admin === 1) {
      userRole = 'admin';
    } else {
      res.status(403).json({ error: 'Not a member of this project' });
      return;
    }
  }

  const ctx: ProjectContext = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    ownerId: project.owner_id,
    isPrivate: project.is_private === 1,
    userRole,
  };

  req.project = ctx;
  next();
}

/**
 * Factory that returns a middleware checking if the user's project role
 * meets the minimum required role.
 */
export function requireProjectRole(minRole: ProjectRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.project) {
      res.status(500).json({ error: 'Project context not set' });
      return;
    }

    if (!hasMinRole(req.project.userRole, minRole)) {
      res.status(403).json({ error: `Requires ${minRole} role or higher` });
      return;
    }

    next();
  };
}
