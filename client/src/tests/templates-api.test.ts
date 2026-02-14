import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api/templates';

const mockTemplate = {
  id: 1,
  project_id: 10,
  name: 'Bug fix',
  title_template: 'Fix: {description}',
  description_template: 'Steps to reproduce:\n1. ...',
  priority: 'high',
  template: 'default',
  tags: 'bug,fix',
  created_at: '2026-01-10',
};

describe('Templates API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('getTemplates calls GET /api/templates', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockTemplate],
    } as Response);

    const result = await getTemplates();
    expect(spy).toHaveBeenCalledWith('/api/templates', expect.any(Object));
    expect(result).toEqual([mockTemplate]);
  });

  it('createTemplate calls POST /api/templates with data', async () => {
    const data = { name: 'Bug fix', title_template: 'Fix: {description}', priority: 'high' };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTemplate,
    } as Response);

    const result = await createTemplate(data);
    expect(spy).toHaveBeenCalledWith('/api/templates', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
    expect(result).toEqual(mockTemplate);
  });

  it('updateTemplate calls PUT /api/templates/:id', async () => {
    const updated = { ...mockTemplate, name: 'Feature request' };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => updated,
    } as Response);

    const result = await updateTemplate(1, { name: 'Feature request' });
    expect(spy).toHaveBeenCalledWith('/api/templates/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ name: 'Feature request' }),
    }));
    expect(result).toEqual(updated);
  });

  it('deleteTemplate calls DELETE /api/templates/:id', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await deleteTemplate(1);
    expect(spy).toHaveBeenCalledWith('/api/templates/1', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toEqual({ success: true });
  });

  it('includes credentials: include in requests', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockTemplate],
    } as Response);

    await getTemplates();
    expect(spy).toHaveBeenCalledWith('/api/templates', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-xyz');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [mockTemplate],
    } as Response);

    await getTemplates();
    expect(spy).toHaveBeenCalledWith('/api/templates', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-xyz' }),
    }));
  });

  it('throws on non-ok response with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ error: 'Template not found' }),
    } as Response);

    await expect(getTemplates()).rejects.toThrow('Template not found');
  });

  it('throws "Request failed" when error has no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    await expect(createTemplate({ name: 'Test' })).rejects.toThrow('Request failed');
  });
});
