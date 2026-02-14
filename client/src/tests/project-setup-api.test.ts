import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSetupStatus,
  connectRepo,
  createNewRepo,
  configureDeploy,
  skipDeploy,
} from '../api/project-setup';

describe('Project Setup API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getSetupStatus calls correct URL', async () => {
    const mockStatus = {
      repoConfigured: false,
      deployConfigured: false,
      gitProvider: null,
      repoUrl: null,
      cfSiteUrl: null,
    };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    } as Response);

    const result = await getSetupStatus();
    expect(spy).toHaveBeenCalledWith('/api/project-setup/status', expect.objectContaining({
      credentials: 'include',
    }));
    expect(result).toEqual(mockStatus);
  });

  it('connectRepo sends POST with correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, repoId: 'proj-1' }),
    } as Response);

    const data = { provider: 'github' as const, owner: 'my-org', repo: 'my-app', token: 'ghp_xxx', branch: 'main' };
    await connectRepo(data);

    expect(spy).toHaveBeenCalledWith('/api/project-setup/connect-repo', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
  });

  it('createNewRepo sends POST with correct body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, repoId: 'proj-1', webUrl: 'https://github.com/org/repo' }),
    } as Response);

    const data = { provider: 'github' as const, token: 'ghp_xxx', repoName: 'new-app', isPrivate: true };
    await createNewRepo(data);

    expect(spy).toHaveBeenCalledWith('/api/project-setup/create-repo', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(data),
    }));
  });

  it('configureDeploy sends POST without body params', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, siteUrl: 'https://test.pages.dev', tenantId: 'uuid' }),
    } as Response);

    await configureDeploy();

    expect(spy).toHaveBeenCalledWith('/api/project-setup/configure-deploy', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('skipDeploy sends POST', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await skipDeploy();

    expect(spy).toHaveBeenCalledWith('/api/project-setup/skip-deploy', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('throws on error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Token invalide ou expiré' }),
    } as Response);

    await expect(connectRepo({
      provider: 'github',
      owner: 'org',
      repo: 'repo',
      token: 'bad',
      branch: 'main',
    })).rejects.toThrow('Token invalide ou expiré');
  });

  it('throws on 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Auth required' }),
    } as Response);

    await expect(getSetupStatus()).rejects.toThrow('Session expired');
  });
});
