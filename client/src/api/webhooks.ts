import type { UserWebhook } from '../types';

const API = '/api';
function projectHeaders(): Record<string, string> {
  const pid = localStorage.getItem('crab-current-project') || '';
  return pid ? { 'X-Project-Id': pid, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

export function getWebhooks(): Promise<UserWebhook[]> {
  return request(`${API}/user-webhooks`, { headers: projectHeaders() });
}

export function createWebhook(data: { url: string; events: string[]; secret?: string }): Promise<UserWebhook> {
  return request(`${API}/user-webhooks`, { method: 'POST', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function updateWebhook(id: number, data: Partial<UserWebhook>): Promise<UserWebhook> {
  return request(`${API}/user-webhooks/${id}`, { method: 'PUT', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function deleteWebhook(id: number): Promise<{ success: boolean }> {
  return request(`${API}/user-webhooks/${id}`, { method: 'DELETE', headers: projectHeaders() });
}
