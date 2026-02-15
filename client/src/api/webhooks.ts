import type { UserWebhook } from '../types';
import { apiJson } from './http';

const API = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiJson<T>(url, {
    ...options,
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
    defaultErrorMessage: 'Request failed',
  });
}

export function getWebhooks(): Promise<UserWebhook[]> {
  return request(`${API}/user-webhooks`);
}

export function createWebhook(data: { url: string; events: string[]; secret?: string }): Promise<UserWebhook> {
  return request(`${API}/user-webhooks`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateWebhook(id: number, data: Partial<UserWebhook>): Promise<UserWebhook> {
  return request(`${API}/user-webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteWebhook(id: number): Promise<{ success: boolean }> {
  return request(`${API}/user-webhooks/${id}`, { method: 'DELETE' });
}
