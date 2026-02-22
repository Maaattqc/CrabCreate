import type { Subtask } from '../types';
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

export function getSubtasks(ticketId: number): Promise<Subtask[]> {
  return request(`${API}/tickets/${ticketId}/subtasks`);
}

export function createSubtask(ticketId: number, title: string, description?: string): Promise<Subtask> {
  const body: Record<string, string> = { title };
  if (description) body.description = description;
  return request(`${API}/tickets/${ticketId}/subtasks`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateSubtask(ticketId: number, subtaskId: number, data: Partial<Subtask>): Promise<Subtask> {
  return request(`${API}/tickets/${ticketId}/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteSubtask(ticketId: number, subtaskId: number): Promise<{ success: boolean }> {
  return request(`${API}/tickets/${ticketId}/subtasks/${subtaskId}`, { method: 'DELETE' });
}
