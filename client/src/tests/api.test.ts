import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTickets, createTicket, deleteTicket, launchPipeline } from '../api/tickets';

const mockTicket = {
  id: 1,
  title: 'Test ticket',
  status: 'backlog',
  ai_model: 'claude',
};

describe('API tickets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getTickets calls fetch with correct URL', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockTicket],
    } as Response);

    const result = await getTickets();
    expect(spy).toHaveBeenCalledWith('/api/tickets', expect.any(Object));
    expect(result).toEqual([mockTicket]);
  });

  it('getTickets passes filters as query params', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await getTickets({ status: 'backlog' });
    expect(spy).toHaveBeenCalledWith('/api/tickets?status=backlog', expect.any(Object));
  });

  it('createTicket sends POST with body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTicket,
    } as Response);

    const data = { title: 'New', description: 'Desc', ai_model: 'claude' };
    await createTicket(data);

    expect(spy).toHaveBeenCalledWith('/api/tickets', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
  });

  it('deleteTicket sends DELETE', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await deleteTicket(1);
    expect(spy).toHaveBeenCalledWith('/api/tickets/1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('launchPipeline sends POST', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await launchPipeline(1);
    expect(spy).toHaveBeenCalledWith('/api/pipeline/launch/1', expect.objectContaining({ method: 'POST' }));
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ error: 'Ticket not found' }),
    } as Response);

    await expect(getTickets()).rejects.toThrow('Ticket not found');
  });
});
