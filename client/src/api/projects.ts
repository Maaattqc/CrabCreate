import type { Project, ProjectMember, ProjectInvitation } from '../types';
import { apiJson } from './http';

const API = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiJson<T>(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
    sessionErrorMessage: 'Session expired',
    defaultErrorMessage: 'Request failed',
  });
}

// Projects CRUD
export const getProjects = (): Promise<Project[]> => request<Project[]>(`${API}/projects`);

export const createProject = (data: { name: string; slug: string; description?: string; is_private?: number; default_repo?: string; auto_repo?: boolean }): Promise<Project & { autoRepoCreated?: boolean; autoRepoWebUrl?: string; autoRepoError?: string }> =>
  request<Project & { autoRepoCreated?: boolean; autoRepoWebUrl?: string; autoRepoError?: string }>(`${API}/projects`, { method: 'POST', body: JSON.stringify(data) });

export const getAutoRepoStatus = (): Promise<{ available: boolean }> =>
  request<{ available: boolean }>(`${API}/projects/auto-repo-status`);

export const getProject = (id: number): Promise<Project> =>
  request<Project>(`${API}/projects/${id}`, { headers: { 'X-Project-Id': String(id) } });

export const updateProject = (id: number, data: Partial<Pick<Project, 'name' | 'description' | 'is_private' | 'default_repo' | 'cursors_enabled' | 'presence_enabled' | 'presence_max_visible'>>): Promise<Project> =>
  request<Project>(`${API}/projects/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: { 'X-Project-Id': String(id), 'Content-Type': 'application/json' } });

export const deleteProject = (id: number): Promise<void> =>
  request<void>(`${API}/projects/${id}`, { method: 'DELETE', headers: { 'X-Project-Id': String(id) } });

// Members
export const getProjectMembers = (projectId: number): Promise<ProjectMember[]> =>
  request<ProjectMember[]>(`${API}/projects/${projectId}/members`, { headers: { 'X-Project-Id': String(projectId) } });

export const inviteMember = (projectId: number, email: string, role: string = 'member'): Promise<void> =>
  request<void>(`${API}/projects/${projectId}/invite`, { method: 'POST', body: JSON.stringify({ email, role }), headers: { 'X-Project-Id': String(projectId), 'Content-Type': 'application/json' } });

export const changeMemberRole = (projectId: number, userId: number, role: string): Promise<void> =>
  request<void>(`${API}/projects/${projectId}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }), headers: { 'X-Project-Id': String(projectId), 'Content-Type': 'application/json' } });

export const removeMember = (projectId: number, userId: number): Promise<void> =>
  request<void>(`${API}/projects/${projectId}/members/${userId}`, { method: 'DELETE', headers: { 'X-Project-Id': String(projectId) } });

export const transferOwnership = (projectId: number, newOwnerId: number): Promise<void> =>
  request<void>(`${API}/projects/${projectId}/transfer-ownership`, { method: 'POST', body: JSON.stringify({ new_owner_id: newOwnerId }), headers: { 'X-Project-Id': String(projectId), 'Content-Type': 'application/json' } });

// Invitations (project-scoped)
export const getProjectInvitations = (projectId: number): Promise<ProjectInvitation[]> =>
  request<ProjectInvitation[]>(`${API}/projects/${projectId}/invitations`, { headers: { 'X-Project-Id': String(projectId) } });

export const cancelInvitation = (projectId: number, invitationId: number): Promise<void> =>
  request<void>(`${API}/projects/${projectId}/invitations/${invitationId}`, { method: 'DELETE', headers: { 'X-Project-Id': String(projectId) } });

// Invitations (user-scoped)
export const getMyInvitations = (): Promise<ProjectInvitation[]> => request<ProjectInvitation[]>(`${API}/invitations`);

export const acceptInvitation = (token: string): Promise<void> =>
  request<void>(`${API}/invitations/${token}/accept`, { method: 'POST' });

export const rejectInvitation = (token: string): Promise<void> =>
  request<void>(`${API}/invitations/${token}/reject`, { method: 'POST' });
