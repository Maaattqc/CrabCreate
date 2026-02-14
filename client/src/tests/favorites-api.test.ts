import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFavorites, toggleFavorite, checkFavorite } from '../api/favorites';

const mockFavorite = {
  user_id: 1,
  ticket_id: 42,
  title: 'Test ticket',
  status: 'backlog',
  priority: 'medium',
  created_at: '2026-01-15',
};

describe('Favorites API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('getFavorites calls GET /api/favorites', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockFavorite],
    } as Response);

    const result = await getFavorites();
    expect(spy).toHaveBeenCalledWith('/api/favorites', expect.any(Object));
    expect(result).toEqual([mockFavorite]);
  });

  it('toggleFavorite calls POST /api/favorites/:ticketId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ favorited: true }),
    } as Response);

    const result = await toggleFavorite(42);
    expect(spy).toHaveBeenCalledWith('/api/favorites/42', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toEqual({ favorited: true });
  });

  it('checkFavorite calls GET /api/favorites/check/:ticketId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ favorited: false }),
    } as Response);

    const result = await checkFavorite(42);
    expect(spy).toHaveBeenCalledWith('/api/favorites/check/42', expect.any(Object));
    expect(result).toEqual({ favorited: false });
  });

  it('includes credentials: include in requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockFavorite],
    } as Response);

    await getFavorites();
    expect(spy).toHaveBeenCalledWith('/api/favorites', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('includes Content-Type header', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockFavorite],
    } as Response);

    await getFavorites();
    expect(spy).toHaveBeenCalledWith('/api/favorites', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('throws on non-ok response with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Not authenticated' }),
    } as Response);

    await expect(getFavorites()).rejects.toThrow('Not authenticated');
  });

  it('throws "Request failed" when error has no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
      json: async () => ({}),
    } as Response);

    await expect(toggleFavorite(42)).rejects.toThrow('Request failed');
  });

  it('toggleFavorite returns favorited: false when removing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ favorited: false }),
    } as Response);

    const result = await toggleFavorite(42);
    expect(result).toEqual({ favorited: false });
  });
});
