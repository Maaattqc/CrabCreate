import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs';
import config from '../config';
import * as repoDb from '../db/repositories';
import { buildCloneUrl } from './git-providers';
import { isAllowedProjectRepoId } from '../security/project-repo';
import type { Ticket, Repo } from '../types';

/**
 * Clones or pulls a repo for a given ticket.
 * Returns the local path to the cloned repo.
 */
async function cloneOrPull(ticket: Ticket): Promise<{ repoDir: string; repo: Repo }> {
  if (!ticket.project_id) {
    throw new Error(`Ticket "${ticket.id}" has no project context`);
  }

  const project = repoDb.findProjectById(ticket.project_id);
  if (!project) {
    throw new Error(`Project "${ticket.project_id}" not found`);
  }
  if (!project.default_repo) {
    throw new Error(`Project "${ticket.project_id}" has no default repo configured`);
  }

  const projectRepoId = String(project.default_repo).trim();
  if (!isAllowedProjectRepoId(ticket.project_id, projectRepoId)) {
    throw new Error(`Security policy blocked unauthorized repo id for project ${ticket.project_id}`);
  }

  const ticketRepoId = String(ticket.repo || projectRepoId).trim();
  if (ticketRepoId !== projectRepoId) {
    throw new Error(`Security policy blocked repo mismatch for project ${ticket.project_id}`);
  }

  const repo = repoDb.findRepoById(projectRepoId);
  if (!repo) throw new Error(`Repo "${projectRepoId}" not found in kanban_repos`);

  const repoDir = path.join(config.reposClonePath, `ticket-${ticket.id}`);

  if (!fs.existsSync(config.reposClonePath)) {
    fs.mkdirSync(config.reposClonePath, { recursive: true });
  }

  const git = simpleGit();

  if (fs.existsSync(path.join(repoDir, '.git'))) {
    // Pull latest — clean untracked files from previous runs first
    const repoGit = simpleGit(repoDir);
    await repoGit.clean('f', ['-d']);
    await repoGit.reset(['--hard']);
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

  // Stage all files BEFORE switching branches — prevents "untracked working tree
  // files would be overwritten by checkout" when AI-generated files (e.g. assets/,
  // index.html) already exist on the target branch.
  await git.add('.');

  // Create branch (or reset it to current HEAD if it already exists from a previous run)
  // checkout -B = create or reset branch to current position
  try {
    await git.checkoutLocalBranch(branchName);
  } catch {
    await git.checkout(['-B', branchName]);
  }

  await git.add('.');
  await git.commit(commitMessage);
  await git.push('origin', branchName, ['--set-upstream', '--force']);
}

/**
 * Auto-discover key files from a repo when no target_files are specified.
 * Reads up to `limit` files, skipping binary/vendor/large files.
 */
function discoverFiles(repoDir: string, limit = 15): { path: string; content: string }[] {
  const resolvedBase = path.resolve(repoDir);
  const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', '.next', '__pycache__', '.cache', 'coverage']);
  const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.webm', '.zip', '.tar', '.gz', '.lock', '.map']);
  const MAX_FILE_SIZE = 30_000; // 30KB
  const files: { path: string; content: string }[] = [];

  function walk(dir: string) {
    if (files.length >= limit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (files.length >= limit) return;
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SKIP_EXTS.has(ext)) continue;

        const fullPath = path.join(dir, entry.name);
        const resolved = path.resolve(fullPath);
        if (!resolved.startsWith(resolvedBase + path.sep)) continue;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relPath = path.relative(repoDir, fullPath).replace(/\\/g, '/');
          files.push({ path: relPath, content });
        } catch { /* skip unreadable */ }
      }
    }
  }

  walk(repoDir);
  return files;
}

export { cloneOrPull, readTargetFiles, writeFiles, commitAndPush, discoverFiles };
