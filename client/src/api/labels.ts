import type { Label } from '../types';
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

export function getLabels(): Promise<Label[]> {
  return request(`${API}/labels`);
}

export function createLabel(data: { name: string; color: string }): Promise<Label> {
  return request(`${API}/labels`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateLabel(id: number, data: Partial<Label>): Promise<Label> {
  return request(`${API}/labels/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteLabel(id: number): Promise<{ success: boolean }> {
  return request(`${API}/labels/${id}`, { method: 'DELETE' });
}

export function getTicketLabels(ticketId: number): Promise<Label[]> {
  return request(`${API}/labels/tickets/${ticketId}`);
}

export function addTicketLabel(ticketId: number, labelId: number): Promise<Label[]> {
  return request(`${API}/labels/tickets/${ticketId}/labels/${labelId}`, { method: 'POST' });
}

export function removeTicketLabel(ticketId: number, labelId: number): Promise<Label[]> {
  return request(`${API}/labels/tickets/${ticketId}/labels/${labelId}`, { method: 'DELETE' });
}
