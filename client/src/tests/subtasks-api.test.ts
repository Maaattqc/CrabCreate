import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubtasks, createSubtask, updateSubtask, deleteSubtask } from '../api/subtasks';

const mockSubtask = {
  id: 1,
  ticket_id: 42,
  title: 'Write unit tests',
  completed: 0,
  position: 0,
  created_at: '2026-01-15',
};

describe('Subtasks API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('getSubtasks calls GET /api/tickets/:ticketId/subtasks', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockSubtask],
    } as Response);

    const result = await getSubtasks(42);
    expect(spy).toHaveBeenCalledWith('/api/tickets/42/subtasks', expect.any(Object));
    expect(result).toEqual([mockSubtask]);
  });

  it('createSubtask calls POST /api/tickets/:ticketId/subtasks with title', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockSubtask,
    } as Response);

    const result = await createSubtask(42, 'Write unit tests');
    expect(spy).toHaveBeenCalledWith('/api/tickets/42/subtasks', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Write unit tests' }),
    }));
    expect(result).toEqual(mockSubtask);
  });

  it('updateSubtask calls PUT /api/tickets/:ticketId/subtasks/:subtaskId', async () => {
    const updated = { ...mockSubtask, completed: 1 };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => updated,
    } as Response);

    const result = await updateSubtask(42, 1, { completed: 1 });
    expect(spy).toHaveBeenCalledWith('/api/tickets/42/subtasks/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ completed: 1 }),
    }));
    expect(result).toEqual(updated);
  });

  it('deleteSubtask calls DELETE /api/tickets/:ticketId/subtasks/:subtaskId', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await deleteSubtask(42, 1);
    expect(spy).toHaveBeenCalledWith('/api/tickets/42/subtasks/1', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toEqual({ success: true });
  });

  it('includes credentials: include in requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockSubtask],
    } as Response);

    await getSubtasks(42);
    expect(spy).toHaveBeenCalledWith('/api/tickets/42/subtasks', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-123');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockSubtask],
    } as Response);

    await getSubtasks(42);
    expect(spy).toHaveBeenCalledWith('/api/tickets/42/subtasks', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-123' }),
    }));
  });

  it('throws on non-ok response with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ error: 'Subtask not found' }),
    } as Response);

    await expect(getSubtasks(42)).rejects.toThrow('Subtask not found');
  });

  it('throws "Request failed" when error response has no error field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    await expect(createSubtask(42, 'Test')).rejects.toThrow('Request failed');
  });
});
