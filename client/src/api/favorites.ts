import type { FavoriteTicket } from '../types';

const API = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> }, credentials: 'include' });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || 'Request failed'); }
  return res.json();
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
