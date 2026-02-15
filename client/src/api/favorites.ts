import type { FavoriteTicket } from '../types';
import { apiJson } from './http';

const API = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiJson<T>(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) },
    defaultErrorMessage: 'Request failed',
  });
}

export function getFavorites(): Promise<FavoriteTicket[]> {
  return request(`${API}/favorites`);
}

export function toggleFavorite(ticketId: number): Promise<{ favorited: boolean }> {
  return request(`${API}/favorites/${ticketId}`, { method: 'POST' });
}

export function checkFavorite(ticketId: number): Promise<{ favorited: boolean }> {
  return request(`${API}/favorites/check/${ticketId}`);
}
