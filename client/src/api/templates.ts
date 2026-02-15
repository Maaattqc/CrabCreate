import type { TicketTemplate } from '../types';
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

export function getTemplates(): Promise<TicketTemplate[]> {
  return request(`${API}/templates`);
}

export function createTemplate(data: Partial<TicketTemplate>): Promise<TicketTemplate> {
  return request(`${API}/templates`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateTemplate(id: number, data: Partial<TicketTemplate>): Promise<TicketTemplate> {
  return request(`${API}/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteTemplate(id: number): Promise<{ success: boolean }> {
  return request(`${API}/templates/${id}`, { method: 'DELETE' });
}
