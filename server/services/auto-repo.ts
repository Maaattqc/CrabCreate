import { createGitProvider, buildCloneUrl } from './git-providers';
import * as repo from '../db/repositories';
import logger from './logger';

interface AutoRepoResult {
  success: boolean;
  repoId?: string;
  webUrl?: string;
  error?: string;
}

export function isAutoRepoConfigured(): boolean {
  const token = process.env.AUTO_REPO_GITHUB_TOKEN;
  const owner = process.env.AUTO_REPO_GITHUB_OWNER;
  if (!token || !owner) return false;
  // Enabled by default when env vars are set; admin can explicitly disable via settings
  const enabled = repo.getConfig('auto_repo_enabled');
  if (enabled === '0') return false;
  return true;
}

export async function autoCreateRepo(
  projectId: number,
  slug: string,
  isPrivate?: boolean,
): Promise<AutoRepoResult> {
  const token = process.env.AUTO_REPO_GITHUB_TOKEN;
  const owner = process.env.AUTO_REPO_GITHUB_OWNER;
  if (!token || !owner) return { success: false, error: 'GitHub credentials not configured' };

  const repoPrivate = isPrivate ?? (repo.getConfig('auto_repo_default_private') !== '0');
  const repoName = slug;

  try {
    const gitProvider = createGitProvider('github', token, owner, '');
    const valid = await gitProvider.validateToken();
    if (!valid) return { success: false, error: 'GitHub token invalid' };

    const result = await gitProvider.createRepo(repoName, repoPrivate);
    const cloneUrl = buildCloneUrl('github', token, owner, repoName);
    const repoId = `proj-${projectId}`;

    repo.createOrUpdateRepo(repoId, {
      label: `${owner}/${repoName}`,
      git_provider: 'github',
      provider_owner: owner,
      provider_repo: repoName,
      provider_token: token,
      clone_url: cloneUrl,
      default_branch: 'main',
      bitbucket_workspace: '',
      bitbucket_repo_slug: '',
    });

    repo.updateProject(projectId, { default_repo: repoId });
    repo.updateProjectSetup(projectId, true);

    logger.info(`[AutoRepo] Created repo ${owner}/${repoName} for project ${projectId}`);
    return { success: true, repoId, webUrl: result.webUrl };
  } catch (err) {
    logger.error('[AutoRepo] Failed:', err);
    return { success: false, error: (err as Error).message || 'Auto-repo creation failed' };
  }
}
