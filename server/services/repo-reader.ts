import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs';
import config from '../config';
import * as repoDb from '../db/repositories';
import { buildCloneUrl } from './git-providers';
import type { Ticket, Repo } from '../types';

/**
 * Clones or pulls a repo for a given ticket.
 * Returns the local path to the cloned repo.
 */
async function cloneOrPull(ticket: Ticket): Promise<{ repoDir: string; repo: Repo }> {
  const repo = repoDb.findRepoById(ticket.repo || 'main-site');
  if (!repo) throw new Error(`Repo "${ticket.repo}" not found in kanban_repos`);

  const repoDir = path.join(config.reposClonePath, `ticket-${ticket.id}`);

  if (!fs.existsSync(config.reposClonePath)) {
    fs.mkdirSync(config.reposClonePath, { recursive: true });
  }

  const git = simpleGit();

  if (fs.existsSync(path.join(repoDir, '.git'))) {
    // Pull latest
    const repoGit = simpleGit(repoDir);
    const defaultBranch = repoDb.getConfig('git_default_branch') || 'master';
    await repoGit.checkout(repo.default_branch || defaultBranch);
    await repoGit.pull();
  } else {
    // Clone — build URL from provider config or fallback to legacy Bitbucket
    let cloneUrl: string;
    if (repo.clone_url) {
      cloneUrl = repo.clone_url;
    } else if (repo.provider_token && repo.provider_owner && repo.provider_repo) {
      cloneUrl = buildCloneUrl(repo.git_provider || 'bitbucket', repo.provider_token, repo.provider_owner, repo.provider_repo);
    } else {
      // Legacy Bitbucket fallback
      cloneUrl = `https://${config.bitbucket.username}:${config.bitbucket.appPassword}@bitbucket.org/${repo.bitbucket_workspace}/${repo.bitbucket_repo_slug}.git`;
    }

    try {
      await git.clone(cloneUrl, repoDir);
    } catch (err: unknown) {
      // Strip credentials from error messages before re-throwing
      const message = err instanceof Error ? err.message : String(err);
      const sanitized = message.replace(/https:\/\/[^@]+@/, 'https://***@');
      throw new Error(`Git clone failed: ${sanitized}`);
    }
  }

  return { repoDir, repo };
}

/**
 * Reads target files from the cloned repo.
 */
function readTargetFiles(repoDir: string, targetFiles: string[]): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const resolvedBase = path.resolve(repoDir);

  for (const filePath of targetFiles) {
    // Path traversal protection
    const fullPath = path.resolve(repoDir, filePath);
    if (!fullPath.startsWith(resolvedBase + path.sep) && fullPath !== resolvedBase) {
      console.warn(`[RepoReader] Path traversal blocked: ${filePath}`);
      continue;
    }

    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      files.push({ path: filePath, content });
    } else {
      files.push({ path: filePath, content: '// FILE NOT FOUND - NEW FILE' });
    }
  }

  return files;
}

/**
 * Writes modified files to the cloned repo.
 */
function writeFiles(repoDir: string, files: { path: string; content: string }[]): void {
  const resolvedBase = path.resolve(repoDir);

  for (const file of files) {
    const fullPath = path.resolve(repoDir, file.path);
    // Path traversal protection
    if (!fullPath.startsWith(resolvedBase + path.sep) && fullPath !== resolvedBase) {
      console.warn(`[RepoReader] Path traversal blocked on write: ${file.path}`);
      continue;
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, file.content, 'utf-8');
  }
}

/**
 * Creates a branch, commits, and pushes changes.
 */
async function commitAndPush(repoDir: string, branchName: string, commitMessage: string): Promise<void> {
  const git = simpleGit(repoDir);

  // Create and checkout branch
  try {
    await git.checkoutLocalBranch(branchName);
  } catch {
    await git.checkout(branchName);
  }

  await git.add('.');
  await git.commit(commitMessage);
  await git.push('origin', branchName, ['--set-upstream']);
}

export { cloneOrPull, readTargetFiles, writeFiles, commitAndPush };
