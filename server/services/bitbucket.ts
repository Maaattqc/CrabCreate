import axios from 'axios';
import config from '../config';
import * as repo from '../db/repositories';

const API_BASE = 'https://api.bitbucket.org/2.0';

function getAuth(): { username: string; password: string } {
  return {
    username: config.bitbucket.username,
    password: config.bitbucket.appPassword,
  };
}

/**
 * Create a Pull Request on Bitbucket.
 */
async function createPR(
  workspace: string,
  repoSlug: string,
  branchName: string,
  title: string,
  description: string,
  targetBranch: string = 'master'
): Promise<{ id: number; url: string }> {
  const url = `${API_BASE}/repositories/${workspace}/${repoSlug}/pullrequests`;

  const response = await axios.post(url, {
    title,
    description,
    source: { branch: { name: branchName } },
    destination: { branch: { name: targetBranch } },
    close_source_branch: (repo.getConfig('git_pr_close_source_branch') || '1') === '1',
  }, { auth: getAuth() });

  return {
    id: response.data.id,
    url: response.data.links?.html?.href || '',
  };
}

/**
 * Merge a Pull Request.
 */
async function mergePR(workspace: string, repoSlug: string, prId: number, mergeStrategy: string = 'merge_commit'): Promise<void> {
  const url = `${API_BASE}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/merge`;
  await axios.post(url, {
    merge_strategy: mergeStrategy,
  }, { auth: getAuth() });
}

/**
 * Decline/close a Pull Request.
 */
async function declinePR(workspace: string, repoSlug: string, prId: number): Promise<void> {
  const url = `${API_BASE}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/decline`;
  await axios.post(url, {}, { auth: getAuth() });
}

export { createPR, mergePR, declinePR };
