import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook } from '../api/webhooks';

const mockWebhook = {
  id: 1,
  project_id: 10,
  url: 'https://example.com/hook',
  events: 'ticket.created,ticket.updated',
  secret: 'abc123',
  enabled: 1,
  created_at: '2026-01-10',
};

describe('Webhooks API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('getWebhooks calls GET /api/user-webhooks', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockWebhook],
    } as Response);

    const result = await getWebhooks();
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks', expect.any(Object));
    expect(result).toEqual([mockWebhook]);
  });

  it('createWebhook calls POST /api/user-webhooks with data', async () => {
    const data = { url: 'https://example.com/hook', events: ['ticket.created'], secret: 'abc123' };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockWebhook,
    } as Response);

    const result = await createWebhook(data);
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
    expect(result).toEqual(mockWebhook);
  });

  it('createWebhook works without secret', async () => {
    const data = { url: 'https://example.com/hook', events: ['ticket.created'] };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockWebhook, secret: null }),
    } as Response);

    await createWebhook(data);
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
  });

  it('updateWebhook calls PUT /api/user-webhooks/:id', async () => {
    const updated = { ...mockWebhook, enabled: 0 };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => updated,
    } as Response);

    const result = await updateWebhook(1, { enabled: 0 });
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ enabled: 0 }),
    }));
    expect(result).toEqual(updated);
  });

  it('deleteWebhook calls DELETE /api/user-webhooks/:id', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await deleteWebhook(1);
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks/1', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toEqual({ success: true });
  });

  it('includes credentials: include in requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockWebhook],
    } as Response);

    await getWebhooks();
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-wh');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockWebhook],
    } as Response);

    await getWebhooks();
    expect(spy).toHaveBeenCalledWith('/api/user-webhooks', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-wh' }),
    }));
  });

  it('throws on non-ok response with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ error: 'Webhook not found' }),
    } as Response);

    await expect(getWebhooks()).rejects.toThrow('Webhook not found');
  });

  it('throws "Request failed" when error has no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
      json: async () => ({}),
    } as Response);

    await expect(deleteWebhook(1)).rejects.toThrow('Request failed');
  });
});
