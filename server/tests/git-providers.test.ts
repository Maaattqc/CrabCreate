import { describe, it, expect } from 'vitest';
import { createGitProvider, buildCloneUrl } from '../services/git-providers';

describe('createGitProvider', () => {
  it('creates a GitHub provider', () => {
    const provider = createGitProvider('github', 'ghp_token', 'my-org', 'my-repo');
    expect(provider).toBeDefined();
    expect(provider.validateToken).toBeTypeOf('function');
    expect(provider.createRepo).toBeTypeOf('function');
    expect(provider.createPR).toBeTypeOf('function');
    expect(provider.mergePR).toBeTypeOf('function');
    expect(provider.declinePR).toBeTypeOf('function');
  });

  it('creates a GitLab provider', () => {
    const provider = createGitProvider('gitlab', 'glpat-token', 'user', 'repo');
    expect(provider).toBeDefined();
    expect(provider.validateToken).toBeTypeOf('function');
  });

  it('creates a Bitbucket provider', () => {
    const provider = createGitProvider('bitbucket', 'app-password', 'workspace', 'slug');
    expect(provider).toBeDefined();
    expect(provider.validateToken).toBeTypeOf('function');
  });

  it('throws on unknown provider', () => {
    expect(() => createGitProvider('azure', 'tok', 'org', 'repo')).toThrow('Unknown git provider: azure');
  });
});

describe('buildCloneUrl', () => {
  it('builds GitHub clone URL', () => {
    const url = buildCloneUrl('github', 'ghp_abc123', 'my-org', 'my-repo');
    expect(url).toBe('https://x-access-token:ghp_abc123@github.com/my-org/my-repo.git');
  });

  it('builds GitLab clone URL', () => {
    const url = buildCloneUrl('gitlab', 'glpat-xyz', 'user', 'project');
    expect(url).toBe('https://oauth2:glpat-xyz@gitlab.com/user/project.git');
  });

  it('builds Bitbucket clone URL', () => {
    const url = buildCloneUrl('bitbucket', 'app-pass', 'workspace', 'slug');
    expect(url).toBe('https://workspace:app-pass@bitbucket.org/workspace/slug.git');
  });

  it('throws on unknown provider', () => {
    expect(() => buildCloneUrl('azure', 'tok', 'org', 'repo')).toThrow('Unknown git provider: azure');
  });

  it('includes special characters in token correctly', () => {
    const url = buildCloneUrl('github', 'ghp_abc+def/ghi', 'org', 'repo');
    expect(url).toContain('ghp_abc+def/ghi');
    expect(url.startsWith('https://')).toBe(true);
  });
});
