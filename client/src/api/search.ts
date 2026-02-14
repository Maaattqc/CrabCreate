import type { SearchResult } from '../types';

const API = '/api';
function projectHeaders(): Record<string, string> {
  const pid = localStorage.getItem('crab-current-project') || '';
  return pid ? { 'X-Project-Id': pid } : {};
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || 'Request failed'); }
  return res.json();
}

export function globalSearch(query: string): Promise<SearchResult[]> {
  return request(`${API}/search?q=${encodeURIComponent(query)}`, { headers: projectHeaders() });
}
