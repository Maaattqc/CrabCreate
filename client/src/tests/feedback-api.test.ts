import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitFeedback } from '../api/tickets';

describe('submitFeedback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST to /api/feedback with rating', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    const result = await submitFeedback(4);

    expect(spy).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ rating: 4 }),
    }));
    expect(result).toEqual({ ok: true });
  });

  it('includes credentials and content-type', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await submitFeedback(5);

    expect(spy).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }));
  });

  it('throws on error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: 'Trop d\'avis envoyés. Réessayez plus tard.' }),
    } as Response);

    await expect(submitFeedback(3)).rejects.toThrow('Trop d\'avis envoyés');
  });
});
