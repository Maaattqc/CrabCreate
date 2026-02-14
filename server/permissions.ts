import type { ProjectRole, Ticket } from './types';

const ROLE_LEVELS: Record<ProjectRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function hasMinRole(userRole: ProjectRole, minRole: ProjectRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minRole];
}

export function canModifyTicket(ticket: Ticket, userId: number, role: ProjectRole): boolean {
  // Admins/owners can modify any ticket in the project
  if (hasMinRole(role, 'admin')) return true;
  // Members can modify only their own tickets
  if (role === 'member') return ticket.user_id === userId;
  // Viewers cannot modify
  return false;
}

export function canLaunchPipeline(ticket: Ticket, userId: number, role: ProjectRole): boolean {
  if (hasMinRole(role, 'admin')) return true;
  if (role === 'member') return ticket.user_id === userId;
  return false;
}
