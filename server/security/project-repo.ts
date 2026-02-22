import db from '../db/sqlite';
import type { Ticket, Project } from '../types';

export function projectScopedRepoId(projectId: number): string {
  return `proj-${projectId}`;
}

export function isAllowedProjectRepoId(projectId: number, repoId: string): boolean {
  const normalized = repoId.trim();
  if (!normalized) return false;
  return normalized === 'main-site' || normalized === projectScopedRepoId(projectId);
}

export function isTicketRepoValidForProject(ticket: Ticket, projectId: number): boolean {
  const project = db.prepare('SELECT * FROM kanban_projects WHERE id = ?').get(projectId) as Project | undefined;
  if (!project) return false;

  const projectRepoId = String(project.default_repo || '').trim();
  if (!projectRepoId) return true;

  if (!isAllowedProjectRepoId(projectId, projectRepoId)) return false;
  const ticketRepoId = (ticket.repo || projectRepoId).trim();
  return ticketRepoId === projectRepoId;
}
