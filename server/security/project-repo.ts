export function projectScopedRepoId(projectId: number): string {
  return `proj-${projectId}`;
}

export function isAllowedProjectRepoId(projectId: number, repoId: string): boolean {
  const normalized = repoId.trim();
  if (!normalized) return false;
  return normalized === 'main-site' || normalized === projectScopedRepoId(projectId);
}
