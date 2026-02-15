import { describe, it, expect } from 'vitest';
import { isAllowedProjectRepoId, projectScopedRepoId } from '../security/project-repo';

describe('project repo security policy', () => {
  it('allows main-site for any project', () => {
    expect(isAllowedProjectRepoId(1, 'main-site')).toBe(true);
    expect(isAllowedProjectRepoId(42, 'main-site')).toBe(true);
  });

  it('allows only the project-scoped repo id', () => {
    expect(isAllowedProjectRepoId(12, projectScopedRepoId(12))).toBe(true);
    expect(isAllowedProjectRepoId(12, projectScopedRepoId(13))).toBe(false);
  });

  it('rejects empty and unknown ids', () => {
    expect(isAllowedProjectRepoId(5, '')).toBe(false);
    expect(isAllowedProjectRepoId(5, 'repo-shared-with-other-project')).toBe(false);
  });
});
