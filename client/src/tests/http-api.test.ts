import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiJson, AUTH_UNAUTHORIZED_EVENT } from '../api/http';

describe('HTTP API utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds X-Project-Id when includeProjectId is enabled and a project exists', async () => {
    localStorage.setItem('crab-current-project', 'proj-http');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await apiJson('/api/test', { includeProjectId: true });

    expect(fetchSpy).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-http' }),
      credentials: 'include',
    }));
  });

  it('emits unauthorized event on 401 responses', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener as EventListener);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Not authenticated' }),
    } as unknown as Response);

    await expect(apiJson('/api/test')).rejects.toThrow('Session expired');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener as EventListener);
  });

  it('fails with timeout when request exceeds timeoutMs', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await expect(apiJson('/api/slow', { timeoutMs: 20 })).rejects.toThrow('Request timeout');
  });
});
