import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  provisionTenant,
  deactivateTenant,
  getTenant,
  healthCheck,
  TENANTS_TABLE_SQL,
} from '../services/supabase';

describe('supabase service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TENANTS_TABLE_SQL', () => {
    it('contains CREATE TABLE with correct columns', () => {
      expect(TENANTS_TABLE_SQL).toContain('CREATE TABLE IF NOT EXISTS tenants');
      expect(TENANTS_TABLE_SQL).toContain('project_id INTEGER NOT NULL UNIQUE');
      expect(TENANTS_TABLE_SQL).toContain('id UUID PRIMARY KEY');
      expect(TENANTS_TABLE_SQL).toContain('project_name TEXT NOT NULL');
      expect(TENANTS_TABLE_SQL).toContain('owner_email TEXT NOT NULL');
      expect(TENANTS_TABLE_SQL).toContain('active BOOLEAN');
    });
  });

  describe('provisionTenant', () => {
    it('sends POST to /rest/v1/tenants with upsert headers', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [{}] });

      await provisionTenant({
        tenantId: 'uuid-123',
        projectId: 42,
        projectName: 'My Project',
        ownerEmail: 'user@test.com',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/rest/v1/tenants');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({
        id: 'uuid-123',
        project_id: 42,
        project_name: 'My Project',
        owner_email: 'user@test.com',
        active: true,
      });
      expect(opts.headers['Prefer']).toContain('resolution=merge-duplicates');
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' });

      await expect(provisionTenant({
        tenantId: 'uuid-123',
        projectId: 42,
        projectName: 'Test',
        ownerEmail: 'a@b.com',
      })).rejects.toThrow('Supabase provisionTenant failed (400)');
    });
  });

  describe('deactivateTenant', () => {
    it('sends PATCH with project_id filter', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [{}] });

      await deactivateTenant(42);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/rest/v1/tenants?project_id=eq.42');
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ active: false });
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' });

      await expect(deactivateTenant(1)).rejects.toThrow('Supabase deactivateTenant failed (500)');
    });
  });

  describe('getTenant', () => {
    it('returns tenant info when found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [{
          id: 'uuid-abc',
          project_id: 10,
          project_name: 'Proj',
          owner_email: 'owner@test.com',
        }],
      });

      const tenant = await getTenant(10);

      expect(tenant).toEqual({
        tenantId: 'uuid-abc',
        projectId: 10,
        projectName: 'Proj',
        ownerEmail: 'owner@test.com',
      });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/rest/v1/tenants?project_id=eq.10&limit=1');
      expect(opts.method).toBe('GET');
    });

    it('returns null when no tenant found', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const tenant = await getTenant(999);
      expect(tenant).toBeNull();
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not found' });

      await expect(getTenant(1)).rejects.toThrow('Supabase getTenant failed (404)');
    });
  });

  describe('healthCheck', () => {
    it('returns true when API responds OK', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const ok = await healthCheck();
      expect(ok).toBe(true);
    });

    it('returns false when API fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const ok = await healthCheck();
      expect(ok).toBe(false);
    });

    it('returns false when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const ok = await healthCheck();
      expect(ok).toBe(false);
    });
  });
});
