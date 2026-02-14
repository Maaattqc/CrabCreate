import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalSearch } from '../api/search';

const mockResults = [
  {
    type: 'ticket' as const,
    id: 1,
    ticket_id: 1,
    title: 'Add contact form',
    snippet: 'Create a contact form with validation',
    created_at: '2026-01-15',
  },
  {
    type: 'comment' as const,
    id: 2,
    ticket_id: 1,
    title: 'Add contact form',
    snippet: 'This looks good to me',
    created_at: '2026-01-16',
  },
];

describe('Search API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('globalSearch calls GET /api/search with encoded query', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    } as Response);

    const result = await globalSearch('contact form');
    expect(spy).toHaveBeenCalledWith('/api/search?q=contact%20form', expect.any(Object));
    expect(result).toEqual(mockResults);
  });

  it('encodes special characters in query', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await globalSearch('test&value=1');
    expect(spy).toHaveBeenCalledWith('/api/search?q=test%26value%3D1', expect.any(Object));
  });

  it('encodes unicode characters in query', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await globalSearch('recherche avancee');
    expect(spy).toHaveBeenCalledWith('/api/search?q=recherche%20avancee', expect.any(Object));
  });

  it('includes credentials: include in requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await globalSearch('test');
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-search');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await globalSearch('test');
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-search' }),
    }));
  });

  it('returns empty array when no results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await globalSearch('nonexistent');
    expect(result).toEqual([]);
  });

  it('throws on non-ok response with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Query too short' }),
    } as Response);

    await expect(globalSearch('a')).rejects.toThrow('Query too short');
  });

  it('throws "Request failed" when error has no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    await expect(globalSearch('test')).rejects.toThrow('Request failed');
  });
});
