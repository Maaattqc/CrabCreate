import type { Label } from '../types';

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

export function getLabels(): Promise<Label[]> {
  return request(`${API}/labels`, { headers: projectHeaders() });
}

export function createLabel(data: { name: string; color: string }): Promise<Label> {
  return request(`${API}/labels`, { method: 'POST', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function updateLabel(id: number, data: Partial<Label>): Promise<Label> {
  return request(`${API}/labels/${id}`, { method: 'PUT', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function deleteLabel(id: number): Promise<{ success: boolean }> {
  return request(`${API}/labels/${id}`, { method: 'DELETE', headers: projectHeaders() });
}

export function getTicketLabels(ticketId: number): Promise<Label[]> {
  return request(`${API}/labels/tickets/${ticketId}`, { headers: projectHeaders() });
}

export function addTicketLabel(ticketId: number, labelId: number): Promise<Label[]> {
  return request(`${API}/labels/tickets/${ticketId}/labels/${labelId}`, { method: 'POST', headers: projectHeaders() });
}

export function removeTicketLabel(ticketId: number, labelId: number): Promise<Label[]> {
  return request(`${API}/labels/tickets/${ticketId}/labels/${labelId}`, { method: 'DELETE', headers: projectHeaders() });
}
