import type { Subtask } from '../types';

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

export function getSubtasks(ticketId: number): Promise<Subtask[]> {
  return request(`${API}/tickets/${ticketId}/subtasks`, { headers: projectHeaders() });
}

export function createSubtask(ticketId: number, title: string): Promise<Subtask> {
  return request(`${API}/tickets/${ticketId}/subtasks`, { method: 'POST', headers: projectHeaders(), body: JSON.stringify({ title }) });
}

export function updateSubtask(ticketId: number, subtaskId: number, data: Partial<Subtask>): Promise<Subtask> {
  return request(`${API}/tickets/${ticketId}/subtasks/${subtaskId}`, { method: 'PUT', headers: projectHeaders(), body: JSON.stringify(data) });
}

export function deleteSubtask(ticketId: number, subtaskId: number): Promise<{ success: boolean }> {
  return request(`${API}/tickets/${ticketId}/subtasks/${subtaskId}`, { method: 'DELETE', headers: projectHeaders() });
}
