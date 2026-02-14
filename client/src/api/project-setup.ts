import type { ProjectSetupStatus, ConnectRepoPayload, CreateRepoPayload } from '../types';

const API = '/api';

function getProjectId(): string {
  return localStorage.getItem('crab-current-project') || '';
}

function projectHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const pid = getProjectId();
  return pid ? { 'Content-Type': 'application/json', 'X-Project-Id': pid, ...extra } : { 'Content-Type': 'application/json', ...extra };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: projectHeaders(options.headers as Record<string, string>),
    credentials: 'include',
  });
  if (res.status === 401) throw new Error('Session expired');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export async function getSetupStatus(): Promise<ProjectSetupStatus> {
  return request<ProjectSetupStatus>(`${API}/project-setup/status`);
}

export async function connectRepo(data: ConnectRepoPayload): Promise<{ success: boolean; repoId: string }> {
  return request(`${API}/project-setup/connect-repo`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createNewRepo(data: CreateRepoPayload): Promise<{ success: boolean; repoId: string; webUrl: string }> {
  return request(`${API}/project-setup/create-repo`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function configureDeploy(): Promise<{ success: boolean; siteUrl: string; tenantId: string }> {
  return request(`${API}/project-setup/configure-deploy`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function skipDeploy(): Promise<{ success: boolean }> {
  return request(`${API}/project-setup/skip-deploy`, {
    method: 'POST',
  });
}
