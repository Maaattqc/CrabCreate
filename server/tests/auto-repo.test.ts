import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  createOrUpdateRepo: vi.fn(),
  updateProject: vi.fn(),
  updateProjectSetup: vi.fn(),
  findProjectById: vi.fn(),
  insertAuditLog: vi.fn(),
  createGitProvider: vi.fn(),
  buildCloneUrl: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../db/repositories', () => ({
  getConfig: mocks.getConfig,
  createOrUpdateRepo: mocks.createOrUpdateRepo,
  updateProject: mocks.updateProject,
  updateProjectSetup: mocks.updateProjectSetup,
  findProjectById: mocks.findProjectById,
  insertAuditLog: mocks.insertAuditLog,
}));

vi.mock('../services/git-providers', () => ({
  createGitProvider: mocks.createGitProvider,
  buildCloneUrl: mocks.buildCloneUrl,
}));

vi.mock('../services/logger', () => ({
  default: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { isAutoRepoConfigured, autoCreateRepo } from '../services/auto-repo';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('auto-repo service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── isAutoRepoConfigured ─────────────────────────────────────────────────

  describe('isAutoRepoConfigured', () => {
    it('returns false when auto_repo_enabled is explicitly "0"', () => {
      mocks.getConfig.mockReturnValue('0');
      process.env.AUTO_REPO_GITHUB_TOKEN = 'ghp_test';
      process.env.AUTO_REPO_GITHUB_OWNER = 'my-org';

      expect(isAutoRepoConfigured()).toBe(false);
    });

    it('returns false when token is missing', () => {
      delete process.env.AUTO_REPO_GITHUB_TOKEN;
      process.env.AUTO_REPO_GITHUB_OWNER = 'my-org';

      expect(isAutoRepoConfigured()).toBe(false);
    });

    it('returns false when owner is missing', () => {
      process.env.AUTO_REPO_GITHUB_TOKEN = 'ghp_test';
      delete process.env.AUTO_REPO_GITHUB_OWNER;

      expect(isAutoRepoConfigured()).toBe(false);
    });

    it('returns true when env vars present and enabled is "1"', () => {
      mocks.getConfig.mockReturnValue('1');
      process.env.AUTO_REPO_GITHUB_TOKEN = 'ghp_test';
      process.env.AUTO_REPO_GITHUB_OWNER = 'my-org';

      expect(isAutoRepoConfigured()).toBe(true);
    });

    it('returns true when env vars present and config is undefined (not set)', () => {
      mocks.getConfig.mockReturnValue(undefined);
      process.env.AUTO_REPO_GITHUB_TOKEN = 'ghp_test';
      process.env.AUTO_REPO_GITHUB_OWNER = 'my-org';

      expect(isAutoRepoConfigured()).toBe(true);
    });

    it('returns true when env vars present and config is any non-"0" value', () => {
      mocks.getConfig.mockReturnValue('yes');
      process.env.AUTO_REPO_GITHUB_TOKEN = 'ghp_test';
      process.env.AUTO_REPO_GITHUB_OWNER = 'my-org';

      expect(isAutoRepoConfigured()).toBe(true);
    });
  });

  // ── autoCreateRepo ───────────────────────────────────────────────────────

  describe('autoCreateRepo', () => {
    const mockGitProvider = {
      validateToken: vi.fn(),
      createRepo: vi.fn(),
      createPR: vi.fn(),
      mergePR: vi.fn(),
      declinePR: vi.fn(),
    };

    beforeEach(() => {
      process.env.AUTO_REPO_GITHUB_TOKEN = 'ghp_test123';
      process.env.AUTO_REPO_GITHUB_OWNER = 'my-org';
      mocks.createGitProvider.mockReturnValue(mockGitProvider);
      mocks.buildCloneUrl.mockReturnValue('https://x-access-token:ghp_test123@github.com/my-org/my-project.git');
    });

    it('returns error when token is missing', async () => {
      delete process.env.AUTO_REPO_GITHUB_TOKEN;

      const result = await autoCreateRepo(1, 'my-project');
      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub credentials not configured');
    });

    it('returns error when owner is missing', async () => {
      delete process.env.AUTO_REPO_GITHUB_OWNER;

      const result = await autoCreateRepo(1, 'my-project');
      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub credentials not configured');
    });

    it('returns error when token validation fails', async () => {
      mockGitProvider.validateToken.mockResolvedValue(false);

      const result = await autoCreateRepo(1, 'my-project');
      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub token invalid');
    });

    it('creates repo, saves to DB, and returns success', async () => {
      mockGitProvider.validateToken.mockResolvedValue(true);
      mockGitProvider.createRepo.mockResolvedValue({
        cloneUrl: 'https://github.com/my-org/my-project.git',
        webUrl: 'https://github.com/my-org/my-project',
      });

      const result = await autoCreateRepo(1, 'my-project');

      expect(result.success).toBe(true);
      expect(result.repoId).toBe('proj-1');
      expect(result.webUrl).toBe('https://github.com/my-org/my-project');

      // Verify git provider was called with correct args
      expect(mocks.createGitProvider).toHaveBeenCalledWith('github', 'ghp_test123', 'my-org', '');
      expect(mockGitProvider.createRepo).toHaveBeenCalledWith('my-project', true); // default private

      // Verify DB updates
      expect(mocks.createOrUpdateRepo).toHaveBeenCalledWith('proj-1', expect.objectContaining({
        label: 'my-org/my-project',
        git_provider: 'github',
        provider_owner: 'my-org',
        provider_repo: 'my-project',
        provider_token: 'ghp_test123',
        default_branch: 'main',
      }));
      expect(mocks.updateProject).toHaveBeenCalledWith(1, { default_repo: 'proj-1' });
      expect(mocks.updateProjectSetup).toHaveBeenCalledWith(1, true);
    });

    it('uses isPrivate parameter when provided', async () => {
      mockGitProvider.validateToken.mockResolvedValue(true);
      mockGitProvider.createRepo.mockResolvedValue({
        cloneUrl: 'https://github.com/my-org/pub-project.git',
        webUrl: 'https://github.com/my-org/pub-project',
      });

      await autoCreateRepo(5, 'pub-project', false);

      expect(mockGitProvider.createRepo).toHaveBeenCalledWith('pub-project', false);
    });

    it('reads auto_repo_default_private from config when isPrivate not provided', async () => {
      mocks.getConfig.mockReturnValue('0'); // default_private = 0 → public
      mockGitProvider.validateToken.mockResolvedValue(true);
      mockGitProvider.createRepo.mockResolvedValue({
        cloneUrl: 'https://github.com/my-org/project.git',
        webUrl: 'https://github.com/my-org/project',
      });

      await autoCreateRepo(2, 'project');

      expect(mockGitProvider.createRepo).toHaveBeenCalledWith('project', false);
    });

    it('defaults to private when auto_repo_default_private is not "0"', async () => {
      mocks.getConfig.mockReturnValue('1'); // default_private = 1 → private
      mockGitProvider.validateToken.mockResolvedValue(true);
      mockGitProvider.createRepo.mockResolvedValue({
        cloneUrl: 'https://github.com/my-org/project.git',
        webUrl: 'https://github.com/my-org/project',
      });

      await autoCreateRepo(3, 'project');

      expect(mockGitProvider.createRepo).toHaveBeenCalledWith('project', true);
    });

    it('returns error and logs when createRepo throws', async () => {
      mockGitProvider.validateToken.mockResolvedValue(true);
      mockGitProvider.createRepo.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await autoCreateRepo(1, 'fail-project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
      expect(mocks.loggerError).toHaveBeenCalled();
      // DB should NOT be updated
      expect(mocks.createOrUpdateRepo).not.toHaveBeenCalled();
    });

    it('returns error and logs when validateToken throws', async () => {
      mockGitProvider.validateToken.mockRejectedValue(new Error('Network error'));

      const result = await autoCreateRepo(1, 'fail-project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(mocks.loggerError).toHaveBeenCalled();
    });

    it('builds clone URL with correct parameters', async () => {
      mockGitProvider.validateToken.mockResolvedValue(true);
      mockGitProvider.createRepo.mockResolvedValue({
        cloneUrl: 'https://github.com/my-org/my-project.git',
        webUrl: 'https://github.com/my-org/my-project',
      });

      await autoCreateRepo(1, 'my-project');

      expect(mocks.buildCloneUrl).toHaveBeenCalledWith('github', 'ghp_test123', 'my-org', 'my-project');
    });
  });
});
