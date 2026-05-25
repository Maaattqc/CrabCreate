import type { ProjectSetupStatus, ConnectRepoPayload, CreateRepoPayload } from '../types';
import { apiJson } from './http';

const API = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiJson<T>(url, {
    ...options,
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
    sessionErrorMessage: 'Session expired',
    defaultErrorMessage: 'Request failed',
  });
}

export async function getSetupStatus(): Promise<ProjectSetupStatus> {
  return request<ProjectSetupStatus>(`${API}/project-setup/status`);
}

export async function testConnection(data: { provider: string; token: string; owner?: string; repo?: string }): Promise<{ success: boolean; error?: string }> {
  return request(`${API}/project-setup/test-connection`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
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

export async function checkAutoRepo(): Promise<{ configured: boolean }> {
  return apiJson<{ configured: boolean }>('/api/projects/auto-repo-status');
}

export async function triggerAutoRepo(): Promise<{ success: boolean; webUrl?: string; error?: string }> {
  return apiJson<{ success: boolean; webUrl?: string; error?: string }>('/api/project-setup/auto-repo', {
    method: 'POST',
    jsonBody: {},
    includeProjectId: true,
  });
}
