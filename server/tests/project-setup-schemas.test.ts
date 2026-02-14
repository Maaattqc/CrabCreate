import { describe, it, expect } from 'vitest';
import { connectRepoSchema, createRepoSchema } from '../schemas';

// ── connectRepoSchema ──────────────────────────────────────────────────────

describe('connectRepoSchema', () => {
  it('accepts valid data with all fields', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'github',
      owner: 'my-org',
      repo: 'my-repo',
      token: 'ghp_xxxx',
      branch: 'main',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provider).toBe('github');
      expect(result.data.branch).toBe('main');
    }
  });

  it('defaults branch to main', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'gitlab',
      owner: 'user',
      repo: 'repo',
      token: 'glpat-xxxx',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.branch).toBe('main');
    }
  });

  it('accepts all three providers', () => {
    for (const provider of ['github', 'gitlab', 'bitbucket'] as const) {
      const result = connectRepoSchema.safeParse({
        provider,
        owner: 'org',
        repo: 'repo',
        token: 'tok123',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid provider', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'azure',
      owner: 'org',
      repo: 'repo',
      token: 'tok',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty owner', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'github',
      owner: '',
      repo: 'repo',
      token: 'tok',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty repo', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'github',
      owner: 'org',
      repo: '',
      token: 'tok',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty token', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'github',
      owner: 'org',
      repo: 'repo',
      token: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = connectRepoSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects token longer than 500 characters', () => {
    const result = connectRepoSchema.safeParse({
      provider: 'github',
      owner: 'org',
      repo: 'repo',
      token: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ── createRepoSchema ───────────────────────────────────────────────────────

describe('createRepoSchema', () => {
  it('accepts valid data', () => {
    const result = createRepoSchema.safeParse({
      provider: 'github',
      token: 'ghp_xxx',
      repoName: 'new-app',
      isPrivate: true,
    });
    expect(result.success).toBe(true);
  });

  it('defaults isPrivate to true', () => {
    const result = createRepoSchema.safeParse({
      provider: 'github',
      token: 'ghp_xxx',
      repoName: 'new-app',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPrivate).toBe(true);
    }
  });

  it('accepts isPrivate false', () => {
    const result = createRepoSchema.safeParse({
      provider: 'gitlab',
      token: 'tok',
      repoName: 'public-app',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPrivate).toBe(false);
    }
  });

  it('rejects empty repoName', () => {
    const result = createRepoSchema.safeParse({
      provider: 'github',
      token: 'tok',
      repoName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty token', () => {
    const result = createRepoSchema.safeParse({
      provider: 'github',
      token: '',
      repoName: 'app',
    });
    expect(result.success).toBe(false);
  });

  it('rejects repoName longer than 100 characters', () => {
    const result = createRepoSchema.safeParse({
      provider: 'github',
      token: 'tok',
      repoName: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

// configureDeploySchema removed — CF credentials are now global env vars
