import type { TicketTemplate } from '../types';

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

export function getTemplates(): Promise<TicketTemplate[]> {
  return request(`${API}/templates`, { headers: projectHeaders() });
}

export function createTemplate(data: Partial<TicketTemplate>): Promise<TicketTemplate> {
  return request(`${API}/templates`, { method: 'POST', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function updateTemplate(id: number, data: Partial<TicketTemplate>): Promise<TicketTemplate> {
  return request(`${API}/templates/${id}`, { method: 'PUT', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function deleteTemplate(id: number): Promise<{ success: boolean }> {
  return request(`${API}/templates/${id}`, { method: 'DELETE', headers: projectHeaders() });
}
