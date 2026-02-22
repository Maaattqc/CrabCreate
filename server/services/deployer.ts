import path from 'path';
import fs from 'fs';
import config from '../config';
import axios from 'axios';
import * as repoReader from './repo-reader';
import * as repoDb from '../db/repositories';
import * as cloudflarePages from './cloudflare-pages';
import { createGitProvider } from './git-providers';
import { emitTicketLog } from '../socket';
import { isAllowedProjectRepoId } from '../security/project-repo';
import logger from './logger';
import { createPatch, applyPatch } from 'diff';
import type { Ticket, CodingResult, DeployResult, CodeFile, Repo } from '../types';

// ── Per-project production deploy lock (serialize concurrent approvals) ───

const productionDeployQueue = new Map<number, Promise<void>>();

// ── Ticket file storage (filesystem) ────────────────────────────────────────

function ticketFilesDir(ticketId: number): string {
  return path.join(config.reposClonePath, `ticket-${ticketId}`);
}

/** Save coding files + base files to disk for later use at approval time. */
function saveTicketFiles(ticketId: number, codingFiles: CodeFile[], baseFiles: CodeFile[]): void {
  const dir = ticketFilesDir(ticketId);
  const codingDir = path.join(dir, 'coding');
  const baseDir = path.join(dir, 'base');

  for (const [subDir, files] of [[codingDir, codingFiles], [baseDir, baseFiles]] as const) {
    fs.mkdirSync(subDir, { recursive: true });
    for (const file of files) {
      const filePath = path.resolve(subDir, file.path);
      if (!filePath.startsWith(path.resolve(subDir) + path.sep) && filePath !== path.resolve(subDir)) continue;
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, file.content, 'utf-8');
    }
  }
  // Write a manifest so we know which files were modified
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    coding: codingFiles.map(f => f.path),
    base: baseFiles.map(f => f.path),
  }), 'utf-8');
}

/** Read stored ticket files from disk. */
function readTicketFiles(ticketId: number): { codingFiles: CodeFile[]; baseFiles: CodeFile[] } {
  const dir = ticketFilesDir(ticketId);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { codingFiles: [], baseFiles: [] };

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const codingDir = path.join(dir, 'coding');
  const baseDir = path.join(dir, 'base');

  const readFiles = (subDir: string, paths: string[]): CodeFile[] =>
    paths.map(p => {
      const filePath = path.resolve(subDir, p);
      if (!fs.existsSync(filePath)) return null;
      return { path: p, content: fs.readFileSync(filePath, 'utf-8') };
    }).filter(Boolean) as CodeFile[];

  return {
    codingFiles: readFiles(codingDir, manifest.coding || []),
    baseFiles: readFiles(baseDir, manifest.base || []),
  };
}

/** Save pending chat modification files to disk. */
function savePendingChatFiles(ticketId: number, files: CodeFile[]): void {
  const dir = path.join(ticketFilesDir(ticketId), 'pending');
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const filePath = path.resolve(dir, file.path);
    if (!filePath.startsWith(path.resolve(dir) + path.sep) && filePath !== path.resolve(dir)) continue;
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, file.content, 'utf-8');
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ files: files.map(f => f.path) }), 'utf-8');
}

/** Check if there are pending chat modification files. */
function hasPendingChatFiles(ticketId: number): boolean {
  const manifest = path.join(ticketFilesDir(ticketId), 'pending', 'manifest.json');
  return fs.existsSync(manifest);
}

/** Read pending chat modification files from disk. */
function readPendingChatFiles(ticketId: number): CodeFile[] {
  const dir = path.join(ticketFilesDir(ticketId), 'pending');
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  return (manifest.files || []).map((p: string) => {
    const filePath = path.resolve(dir, p);
    if (!fs.existsSync(filePath)) return null;
    return { path: p, content: fs.readFileSync(filePath, 'utf-8') };
  }).filter(Boolean) as CodeFile[];
}

/** Clear pending chat modification files after apply. */
function clearPendingChatFiles(ticketId: number): void {
  const dir = path.join(ticketFilesDir(ticketId), 'pending');
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true }); } catch { /* ignore */ }
}

/** Delete stored ticket files after approval or rejection. */
function cleanupTicketFiles(ticketId: number): void {
  const dir = ticketFilesDir(ticketId);
  try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true }); } catch { /* ignore */ }
}

/**
 * Fetch current production file contents from the live CF Pages site via HTTP.
 * Only fetches the files we need for 3-way merge (the ones modified by the ticket).
 */
async function fetchProductionFiles(siteUrl: string, filePaths: string[]): Promise<CodeFile[]> {
  const results: CodeFile[] = [];
  const baseUrl = siteUrl.replace(/\/+$/, '');

  for (const filePath of filePaths) {
    const url = `${baseUrl}/${filePath.replace(/^\/+/, '')}`;
    try {
      const res = await axios.get(url, { timeout: 10_000, responseType: 'text' });
      if (res.status === 200 && typeof res.data === 'string') {
        results.push({ path: filePath, content: res.data });
      }
    } catch {
      // File doesn't exist in production yet — skip
    }
  }
  return results;
}

/**
 * Checks if a repo has enough config to create PRs (via new providers or legacy Bitbucket).
 */
function isRepoConfigured(repo: Repo): boolean {
  // New multi-provider: needs token + owner + repo name
  if (repo.provider_token && repo.provider_owner && repo.provider_repo) return true;
  // Legacy Bitbucket: needs workspace + slug
  if (repo.bitbucket_workspace && repo.bitbucket_repo_slug) return true;
  return false;
}

/**
 * Get a GitProvider instance from a Repo record.
 */
function getProvider(repo: Repo) {
  return createGitProvider(
    repo.git_provider || 'bitbucket',
    repo.provider_token || '',
    repo.provider_owner || repo.bitbucket_workspace,
    repo.provider_repo || repo.bitbucket_repo_slug,
  );
}

function resolveAuthorizedRepo(ticket: Ticket): Repo | null {
  if (!ticket.project_id) return null;

  const project = repoDb.findProjectById(ticket.project_id);
  if (!project) return null;

  // Project without repo (greenfield) — no repo to resolve
  const projectRepoId = String(project.default_repo || '').trim();
  if (!projectRepoId) return null;

  if (!isAllowedProjectRepoId(ticket.project_id, projectRepoId)) {
    throw new Error(`Security policy blocked unauthorized repo id for project ${ticket.project_id}`);
  }

  const ticketRepoId = String(ticket.repo || projectRepoId).trim();
  if (ticketRepoId !== projectRepoId) {
    throw new Error(`Security policy blocked repo mismatch for project ${ticket.project_id}`);
  }

  return repoDb.findRepoById(projectRepoId) || null;
}

/**
 * Get Cloudflare credentials: project-level DB config first, then env vars fallback.
 * The API token/account ID may be shared across projects, but each project gets
 * its own CF Pages project with unique URLs (created automatically by deployCfFiles).
 */
function getCfCredentials(projectId: number | null): { token: string; accountId: string } | null {
  if (!projectId) return null;
  // 1. Project-level config (stored after first deploy)
  const deployConfig = repoDb.findDeployConfigByProject(projectId);
  if (deployConfig?.cf_api_token && deployConfig?.cf_account_id) {
    return { token: deployConfig.cf_api_token, accountId: deployConfig.cf_account_id };
  }
  // 2. Global env vars — deployCfFiles will auto-create a unique CF project and store config in DB
  const envToken = process.env.CF_API_TOKEN;
  const envAccountId = process.env.CF_ACCOUNT_ID;
  if (envToken && envAccountId) {
    return { token: envToken, accountId: envAccountId };
  }
  return null;
}

/**
 * Deploy files to Cloudflare Pages and return the per-deployment preview URL.
 * Ensures the CF project exists, writes files to a temp dir, deploys via wrangler.
 */
async function deployCfFiles(
  ticket: Ticket,
  files: CodingResult['files'],
  cf: { token: string; accountId: string },
): Promise<string> {
  const project = ticket.project_id ? repoDb.findProjectById(ticket.project_id) : null;
  const slug = project?.slug || `proj-${ticket.project_id}`;
  const cfProjectName = `crab-${slug}`.replace(/[^a-zA-Z0-9_-]/g, '-').substring(0, 58);

  // Write generated files to a temp dist directory
  const distDir = path.join(config.reposClonePath, `cf-deploy-${ticket.id}`);
  if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  for (const file of files) {
    const filePath = path.resolve(distDir, file.path);
    // Path traversal protection
    if (!filePath.startsWith(path.resolve(distDir) + path.sep) && filePath !== path.resolve(distDir)) continue;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, file.content, 'utf-8');
  }

  // Auto-generate index.html ONLY if none was provided AND no production manifest exists
  // (first-ever deploy for a project — subsequent deploys inherit index.html from production)
  const indexPath = path.join(distDir, 'index.html');
  const existingDeployConfig = ticket.project_id ? repoDb.findDeployConfigByProject(ticket.project_id) : null;
  const hasProductionIndex = existingDeployConfig?.production_manifest
    ? Object.keys(JSON.parse(existingDeployConfig.production_manifest)).some(p => p === '/index.html')
    : false;

  if (!fs.existsSync(indexPath) && !hasProductionIndex) {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const pName = escapeHtml(project?.name || `Ticket #${ticket.id}`);
    const ticketTitle = escapeHtml(ticket.title || '');
    const cssLinks = files.filter(f => f.path.endsWith('.css'))
      .map(f => `<link rel="stylesheet" href="/${escapeHtml(f.path)}">`).join('\n');
    const jsScripts = files.filter(f => f.path.endsWith('.js') || f.path.endsWith('.mjs'))
      .map(f => `<script src="/${escapeHtml(f.path)}"></script>`).join('\n');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pName}</title>
${cssLinks}
<style>body{font-family:system-ui,sans-serif;margin:0;padding:0;color:#e4e4e7;background:#18181b}
.crab-preview-banner{max-width:700px;margin:2rem auto;padding:0 1rem}
.crab-preview-banner h1{font-size:1.25rem;margin-bottom:.25rem}
.crab-preview-banner p{color:#a1a1aa;font-size:.875rem}</style></head>
<body>
  <div class="crab-preview-banner">
    <h1>${pName}</h1>
    <p>${ticketTitle}</p>
  </div>
${jsScripts}
</body>
</html>`;
    fs.writeFileSync(indexPath, html, 'utf-8');
    emitTicketLog(ticket.id, 'index.html auto-généré (premier déploiement)', 'info', 'deploying');
  }

  // Ensure CF project exists
  let deployConfig = ticket.project_id ? repoDb.findDeployConfigByProject(ticket.project_id) : null;
  if (!deployConfig?.cf_project_name) {
    try {
      emitTicketLog(ticket.id, `Création du projet Cloudflare Pages "${cfProjectName}"...`, 'info', 'deploying');
      const cfResult = await cloudflarePages.createProject(cf.accountId, cfProjectName, cf.token);

      if (ticket.project_id) {
        if (deployConfig) {
          repoDb.updateDeployConfig(ticket.project_id, {
            cf_project_name: cfResult.name,
            cf_site_url: cfResult.url,
            cf_api_token: cf.token,
            cf_account_id: cf.accountId,
          });
        } else {
          repoDb.createDeployConfig(ticket.project_id, {
            cf_project_name: cfResult.name,
            cf_site_url: cfResult.url,
            cf_api_token: cf.token,
            cf_account_id: cf.accountId,
          });
        }
        deployConfig = repoDb.findDeployConfigByProject(ticket.project_id);
      }
    } catch (err) {
      // Project might already exist — ensure deploy config has cf_site_url anyway
      logger.warn('[Deployer] CF project creation failed (may already exist):', (err as Error).message);
      const productionUrl = `https://${cfProjectName}.pages.dev`;
      if (ticket.project_id) {
        if (deployConfig) {
          if (!deployConfig.cf_site_url) {
            repoDb.updateDeployConfig(ticket.project_id, {
              cf_project_name: cfProjectName,
              cf_site_url: productionUrl,
              cf_api_token: cf.token,
              cf_account_id: cf.accountId,
            });
          }
        } else {
          repoDb.createDeployConfig(ticket.project_id, {
            cf_project_name: cfProjectName,
            cf_site_url: productionUrl,
            cf_api_token: cf.token,
            cf_account_id: cf.accountId,
          });
        }
        deployConfig = repoDb.findDeployConfigByProject(ticket.project_id);
      }
    }
  }

  const projectName = deployConfig?.cf_project_name || cfProjectName;

  // Load production manifest so preview includes the full site, not just changed files
  let productionManifest: Record<string, string> = {};
  if (deployConfig?.production_manifest) {
    try { productionManifest = JSON.parse(deployConfig.production_manifest); } catch { /* ignore */ }
    logger.info(`[Deployer] Loaded production manifest (${Object.keys(productionManifest).length} files) for preview merge`);
  }

  // Deploy files via Cloudflare Direct Upload API (preview branch for staging)
  const previewBranch = `preview-${ticket.id}`;
  logger.info(`[Deployer] Deploying to CF Pages project "${projectName}" on branch "${previewBranch}"...`);
  emitTicketLog(ticket.id, 'Déploiement sur Cloudflare Pages...', 'info', 'deploying');
  const result = await cloudflarePages.deploy(cf.accountId, projectName, distDir, cf.token, previewBranch, productionManifest);

  // Cleanup temp dir
  try { fs.rmSync(distDir, { recursive: true }); } catch { /* ignore */ }

  // Ensure cf_site_url is stored (production URL) even if only preview URL was returned
  if (ticket.project_id && deployConfig && !deployConfig.cf_site_url) {
    const productionUrl = `https://${projectName}.pages.dev`;
    repoDb.updateDeployConfig(ticket.project_id, { cf_site_url: productionUrl });
  }

  emitTicketLog(ticket.id, `Déployé sur ${result.url}`, 'success', 'deploying');

  return result.url;
}

/**
 * Deploy generated files to Cloudflare Pages for greenfield projects (no git repo).
 */
async function deployCfPages(ticket: Ticket, codingResult: CodingResult): Promise<DeployResult> {
  const cf = getCfCredentials(ticket.project_id);
  if (!cf) {
    emitTicketLog(ticket.id, 'Pas de credentials Cloudflare configurés — mode simulation', 'warning', 'deploying');
    return { prUrl: '#simulation', prId: 0, stagingUrl: '' };
  }

  const previewUrl = await deployCfFiles(ticket, codingResult.files, cf);

  return {
    prUrl: '#cloudflare-pages',
    prId: 0,
    stagingUrl: previewUrl,
  };
}

/**
 * Deploy to staging: commit, push, create PR — or CF Pages for greenfield.
 * Every project with CF configured also gets a CF Pages preview deploy.
 */
async function deployToStaging(ticket: Ticket, codingResult: CodingResult): Promise<DeployResult> {
  const repo = resolveAuthorizedRepo(ticket);

  if (!repo || !isRepoConfigured(repo)) {
    // Greenfield project (no git repo) — CF Pages only
    if (codingResult.files && codingResult.files.length > 0) {
      try {
        return await deployCfPages(ticket, codingResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emitTicketLog(ticket.id, `Erreur déploiement CF Pages: ${msg}`, 'warning', 'deploying');
      }
    }

    emitTicketLog(ticket.id, 'Mode simulation: pas de repo Git configuré', 'warning', 'deploying');
    return { prUrl: '#simulation', prId: 0, stagingUrl: '' };
  }

  // ── Git repo path: commit, push, create PR ──
  const branchName = codingResult.branchName;
  const commitMessage = `[CrabCreate #${ticket.id}] ${ticket.title}\n\n${codingResult.summary}`;

  // Skip git push + PR when no repoDir (e.g. skip_coding test mode)
  let pr = { url: '', id: 0 };
  if (codingResult.repoDir) {
    await repoReader.commitAndPush(codingResult.repoDir, branchName, commitMessage);
    emitTicketLog(ticket.id, `Branche "${branchName}" pushée`, 'success', 'deploying');

    const provider = getProvider(repo);
    const targetBranch = repo.default_branch || repoDb.getConfig('git_default_branch') || 'main';
    pr = await provider.createPR(
      branchName,
      targetBranch,
      `[CrabCreate #${ticket.id}] ${ticket.title}`,
      `**Auto-generated by CrabCreate**\n\n${ticket.description}\n\n---\nAI Model: ${ticket.ai_model}\nReview Score: ${ticket.ai_review_score || 'N/A'}/100`,
    );
  }

  // ── Also deploy to CF Pages if configured → preview URL for review ──
  let stagingUrl = '';
  const cf = getCfCredentials(ticket.project_id);
  if (cf && codingResult.files && codingResult.files.length > 0) {
    try {
      stagingUrl = await deployCfFiles(ticket, codingResult.files, cf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitTicketLog(ticket.id, `CF Pages preview failed: ${msg}`, 'warning', 'deploying');
    }
  }

  return {
    prUrl: pr.url,
    prId: pr.id,
    stagingUrl,
  };
}

/**
 * 3-way merge: apply a ticket's changes on top of the current production files.
 * For each file the ticket modified, compute the patch (base → AI-modified)
 * and apply it to the current production content. This allows out-of-order
 * approvals to work correctly when two tickets modify different sections
 * of the same file.
 */
function mergeFiles(
  codingFiles: { path: string; content: string }[],
  baseFiles: { path: string; content: string }[],
  productionFiles: { path: string; content: string }[],
  ticketId: number,
): { path: string; content: string }[] {
  const baseMap = new Map(baseFiles.map(f => [f.path, f.content]));
  const prodMap = new Map(productionFiles.map(f => [f.path, f.content]));
  const merged: { path: string; content: string }[] = [];

  for (const file of codingFiles) {
    const baseContent = baseMap.get(file.path) ?? '';
    const prodContent = prodMap.get(file.path);

    // No production version or production matches original base → no conflict
    if (prodContent === undefined || prodContent === baseContent) {
      merged.push(file);
      continue;
    }

    // Production file has been modified by another ticket since this one was coded.
    // Compute the patch (base → this ticket's version) and apply to current production.
    const patch = createPatch(file.path, baseContent, file.content);
    const result = applyPatch(prodContent, patch);

    if (result === false) {
      // Patch couldn't apply cleanly — fall back to overwrite with warning
      logger.warn(`[Deployer] Merge conflict for ${file.path} in ticket #${ticketId}, using ticket version (overwrite)`);
      emitTicketLog(ticketId, `Conflit de merge sur ${file.path} — version du ticket utilisée`, 'warning', 'deploying');
      merged.push(file);
    } else {
      logger.info(`[Deployer] 3-way merge successful for ${file.path} in ticket #${ticketId}`);
      merged.push({ path: file.path, content: result });
    }
  }

  return merged;
}

/**
 * Merge PR to production (approve flow).
 * For greenfield projects (no git repo), redeploy the staging files to the "main" branch on CF Pages.
 * Uses 3-way merge to handle out-of-order ticket approvals on the same files.
 * Reads ticket files from filesystem, fetches production state from live CF site.
 */
async function mergeToProduction(ticket: Ticket): Promise<void> {
  // Serialize production deploys per project to prevent race conditions
  // (e.g. approve #50 then #49 → #49 must wait for #50's deploy to finish
  //  so it fetches the latest production state including #50's changes)
  if (ticket.project_id) {
    const prev = productionDeployQueue.get(ticket.project_id) ?? Promise.resolve();
    const current = prev
      .catch(() => {}) // don't block on previous failures
      .then(() => doMergeToProduction(ticket));
    productionDeployQueue.set(ticket.project_id, current.catch(() => {}));
    return current;
  }
  return doMergeToProduction(ticket);
}

async function doMergeToProduction(ticket: Ticket): Promise<void> {
  const repo = resolveAuthorizedRepo(ticket);

  // Git repo path: merge the PR
  if (repo && isRepoConfigured(repo) && ticket.pr_id) {
    const mergeStrategy = repoDb.getConfig('git_merge_strategy') || 'merge_commit';
    const provider = getProvider(repo);
    await provider.mergePR(ticket.pr_id, mergeStrategy);
    emitTicketLog(ticket.id, 'PR mergée avec succès', 'success', 'deploying');
  }

  // CF Pages: redeploy to production branch ("main") so it becomes the live site
  const cf = getCfCredentials(ticket.project_id);
  if (cf && ticket.project_id) {
    const deployConfig = repoDb.findDeployConfigByProject(ticket.project_id);
    if (deployConfig?.cf_project_name) {
      // Read coding files from filesystem (saved during pipeline deploy step)
      const { codingFiles, baseFiles } = readTicketFiles(ticket.id);
      if (codingFiles.length > 0) {
        try {
          logger.info(`[Deployer] Promoting ticket #${ticket.id} to CF Pages production...`);
          emitTicketLog(ticket.id, 'Déploiement en production sur Cloudflare Pages...', 'info', 'deploying');

          // 3-way merge: fetch current production files from live site, apply ticket's diff
          let filesToDeploy = codingFiles;
          if (baseFiles.length > 0 && deployConfig.cf_site_url) {
            const productionFiles = await fetchProductionFiles(
              deployConfig.cf_site_url,
              codingFiles.map(f => f.path),
            );
            if (productionFiles.length > 0) {
              filesToDeploy = mergeFiles(codingFiles, baseFiles, productionFiles, ticket.id);
            }
          }

          const distDir = path.join(config.reposClonePath, `cf-prod-${ticket.id}`);
          if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
          fs.mkdirSync(distDir, { recursive: true });

          for (const file of filesToDeploy) {
            const filePath = path.resolve(distDir, file.path);
            if (!filePath.startsWith(path.resolve(distDir) + path.sep) && filePath !== path.resolve(distDir)) continue;
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, file.content, 'utf-8');
          }

          // Load existing production manifest so we accumulate all files over time
          let baseManifest: Record<string, string> = {};
          if (deployConfig.production_manifest) {
            try { baseManifest = JSON.parse(deployConfig.production_manifest); } catch { /* ignore */ }
          }

          const result = await cloudflarePages.deploy(
            cf.accountId,
            deployConfig.cf_project_name,
            distDir,
            cf.token,
            'main', // production branch
            baseManifest,
          );

          try { fs.rmSync(distDir, { recursive: true }); } catch { /* ignore */ }

          // Store the merged manifest for future preview/production deploys
          repoDb.updateDeployConfig(ticket.project_id, {
            production_manifest: JSON.stringify(result.manifest),
          });
          logger.info(`[Deployer] Production manifest saved (${Object.keys(result.manifest).length} files)`);

          // Cleanup ticket files from filesystem
          cleanupTicketFiles(ticket.id);

          emitTicketLog(ticket.id, `Déployé en production: ${result.url}`, 'success', 'deploying');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`[Deployer] CF Pages production deploy failed: ${msg}`);
          emitTicketLog(ticket.id, `Erreur déploiement production CF: ${msg}`, 'warning', 'deploying');
        }
      } else {
        logger.info(`[Deployer] No coding files found for ticket #${ticket.id}, skipping CF prod deploy`);
        emitTicketLog(ticket.id, 'Mode simulation: merge simulé', 'info', 'deploying');
      }
    } else {
      emitTicketLog(ticket.id, 'Mode simulation: merge simulé', 'info', 'deploying');
    }
  } else if (!repo || !isRepoConfigured(repo) || !ticket.pr_id) {
    emitTicketLog(ticket.id, 'Mode simulation: merge simulé', 'info', 'deploying');
  }
}

/**
 * Close/decline PR (reject flow).
 */
async function closePR(ticket: Ticket): Promise<void> {
  const repo = resolveAuthorizedRepo(ticket);

  if (!repo || !isRepoConfigured(repo) || !ticket.pr_id) {
    return;
  }

  const provider = getProvider(repo);
  await provider.declinePR(ticket.pr_id);
  emitTicketLog(ticket.id, 'PR déclinée', 'info', 'deploying');

  // Cleanup ticket files from filesystem
  cleanupTicketFiles(ticket.id);
}

/**
 * Rollback — create a revert commit on master.
 */
async function rollback(ticket: Ticket): Promise<void> {
  emitTicketLog(ticket.id, 'Rollback en cours (simulation)...', 'warning', 'deploying');
  // In a real setup, this would create a revert commit via git or the provider's API
  emitTicketLog(ticket.id, 'Rollback terminé', 'success', 'deploying');
}

export { deployToStaging, mergeToProduction, closePR, rollback, saveTicketFiles, readTicketFiles, cleanupTicketFiles, savePendingChatFiles, hasPendingChatFiles, readPendingChatFiles, clearPendingChatFiles };
