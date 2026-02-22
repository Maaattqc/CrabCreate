import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportCSV, exportPDF } from '../api/export';

describe('Export API', () => {
  let mockClick: ReturnType<typeof vi.fn>;
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    mockClick = vi.fn();
    mockAnchor = { href: '', download: '', click: mockClick };

    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-blob-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
  });

  it('exportCSV calls GET /api/export/csv', async () => {
    const mockBlob = new Blob(['id,title\n1,Test'], { type: 'text/csv' });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await exportCSV();
    expect(spy).toHaveBeenCalledWith('/api/export/csv', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('exportCSV creates blob URL and triggers download', async () => {
    const mockBlob = new Blob(['id,title\n1,Test'], { type: 'text/csv' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await exportCSV();

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockAnchor.href).toBe('blob:http://localhost/fake-blob-url');
    expect(mockAnchor.download).toBe('tickets.csv');
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-blob-url');
  });

  it('exportPDF calls GET /api/export/pdf', async () => {
    const mockBlob = { text: vi.fn().mockResolvedValue('<html>PDF</html>') } as unknown as Blob;
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await exportPDF();
    expect(spy).toHaveBeenCalledWith('/api/export/pdf', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('exportPDF reads blob as text and creates iframe for print', async () => {
    const mockBlob = { text: vi.fn().mockResolvedValue('<html>PDF</html>') } as unknown as Blob;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await exportPDF();

    expect(mockBlob.text).toHaveBeenCalled();
  });

  it('exportCSV throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
    } as Response);

    await expect(exportCSV()).rejects.toThrow('Export failed');
  });

  it('exportPDF throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
    } as Response);

    await expect(exportPDF()).rejects.toThrow('Export failed');
  });

  it('exportCSV includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-export');
    const mockBlob = new Blob(['data'], { type: 'text/csv' });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await exportCSV();
    expect(spy).toHaveBeenCalledWith('/api/export/csv', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-export' }),
    }));
  });

  it('exportPDF includes X-Project-Id header when project is set', async () => {
    localStorage.setItem('crab-current-project', 'proj-export');
    const mockBlob = { text: vi.fn().mockResolvedValue('<html>data</html>') } as unknown as Blob;
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await exportPDF();
    expect(spy).toHaveBeenCalledWith('/api/export/pdf', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Project-Id': 'proj-export' }),
    }));
  });
});
