import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  getTicketLabels,
  addTicketLabel,
  removeTicketLabel,
} from '../api/labels';

const mockLabel = {
  id: 1,
  project_id: 10,
  name: 'bug',
  color: '#ff0000',
  created_at: '2026-01-10',
};

describe('Labels API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('getLabels calls GET /api/labels', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockLabel],
    } as Response);

    const result = await getLabels();
    expect(spy).toHaveBeenCalledWith('/api/labels', expect.any(Object));
    expect(result).toEqual([mockLabel]);
  });

  it('createLabel calls POST /api/labels with name and color', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockLabel,
    } as Response);

    const data = { name: 'bug', color: '#ff0000' };
    const result = await createLabel(data);
    expect(spy).toHaveBeenCalledWith('/api/labels', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
    expect(result).toEqual(mockLabel);
  });

  it('updateLabel calls PUT /api/labels/:id', async () => {
    const updated = { ...mockLabel, name: 'feature' };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => updated,
    } as Response);

    const result = await updateLabel(1, { name: 'feature' });
    expect(spy).toHaveBeenCalledWith('/api/labels/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ name: 'feature' }),
    }));
    expect(result).toEqual(updated);
  });

  it('deleteLabel calls DELETE /api/labels/:id', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await deleteLabel(1);
    expect(spy).toHaveBeenCalledWith('/api/labels/1', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toEqual({ success: true });
  });

  it('getTicketLabels calls GET /api/labels/tickets/:ticketId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockLabel],
    } as Response);

    const result = await getTicketLabels(42);
    expect(spy).toHaveBeenCalledWith('/api/labels/tickets/42', expect.any(Object));
    expect(result).toEqual([mockLabel]);
  });

  it('addTicketLabel calls POST /api/labels/tickets/:ticketId/labels/:labelId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockLabel],
    } as Response);

    const result = await addTicketLabel(42, 1);
    expect(spy).toHaveBeenCalledWith('/api/labels/tickets/42/labels/1', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toEqual([mockLabel]);
  });

  it('removeTicketLabel calls DELETE /api/labels/tickets/:ticketId/labels/:labelId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await removeTicketLabel(42, 1);
    expect(spy).toHaveBeenCalledWith('/api/labels/tickets/42/labels/1', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toEqual([]);
  });

  it('includes credentials: include in all requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockLabel],
    } as Response);

    await getLabels();
    expect(spy).toHaveBeenCalledWith('/api/labels', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-abc');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockLabel],
    } as Response);

    await getLabels();
    expect(spy).toHaveBeenCalledWith('/api/labels', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-abc' }),
    }));
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
      json: async () => ({ error: 'Not authorized' }),
    } as Response);

    await expect(getLabels()).rejects.toThrow('Not authorized');
  });

  it('throws "Request failed" when error has no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
      json: async () => ({}),
    } as Response);

    await expect(createLabel({ name: 'x', color: '#000' })).rejects.toThrow('Request failed');
  });
});
