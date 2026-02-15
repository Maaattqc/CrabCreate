import type { SearchResult } from '../types';
import { apiJson } from './http';

const API = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiJson<T>(url, {
    ...options,
    includeProjectId: true,
    defaultErrorMessage: 'Request failed',
  });
}

export function globalSearch(query: string): Promise<SearchResult[]> {
  return request(`${API}/search?q=${encodeURIComponent(query)}`);
}
