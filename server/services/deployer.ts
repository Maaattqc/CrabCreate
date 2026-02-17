import path from 'path';
import fs from 'fs';
import config from '../config';
import * as repoReader from './repo-reader';
import * as repoDb from '../db/repositories';
import * as cloudflarePages from './cloudflare-pages';
import { createGitProvider } from './git-providers';
import { emitTicketLog } from '../socket';
import { isAllowedProjectRepoId } from '../security/project-repo';
import logger from './logger';
import type { Ticket, CodingResult, DeployResult, Repo } from '../types';

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

  // Auto-generate index.html if none was provided (prevents 522 on CF Pages)
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const projectName = escapeHtml(project?.name || `Ticket #${ticket.id}`);
    const fileLinks = files
      .map(f => `<li><a href="/${escapeHtml(f.path)}">${escapeHtml(f.path)}</a></li>`)
      .join('\n        ');
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${projectName}</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:2rem auto;padding:0 1rem;color:#e4e4e7;background:#18181b}a{color:#38bdf8}h1{font-size:1.25rem}</style></head>
<body>
  <h1>${projectName}</h1>
  <p>Fichiers déployés :</p>
  <ul>
        ${fileLinks}
  </ul>
</body>
</html>`;
    fs.writeFileSync(indexPath, html, 'utf-8');
    emitTicketLog(ticket.id, 'index.html auto-généré', 'info', 'deploying');
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

  // Deploy files via Cloudflare Direct Upload API (preview branch for staging)
  const previewBranch = `preview-${ticket.id}`;
  logger.info(`[Deployer] Deploying to CF Pages project "${projectName}" on branch "${previewBranch}"...`);
  emitTicketLog(ticket.id, 'Déploiement sur Cloudflare Pages...', 'info', 'deploying');
  const result = await cloudflarePages.deploy(cf.accountId, projectName, distDir, cf.token, previewBranch);

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
    const targetBranch = repo.default_branch || repoDb.getConfig('git_default_branch') || 'master';
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
 * Merge PR to production (approve flow).
 * For greenfield projects (no git repo), redeploy the staging files to the "main" branch on CF Pages.
 */
async function mergeToProduction(ticket: Ticket): Promise<void> {
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
      // Re-read the coding result files from the stored log entry
      const codingFiles = repoDb.findCodingFiles(ticket.id);
      if (codingFiles.length > 0) {
        try {
          logger.info(`[Deployer] Promoting ticket #${ticket.id} to CF Pages production...`);
          emitTicketLog(ticket.id, 'Déploiement en production sur Cloudflare Pages...', 'info', 'deploying');

          const distDir = path.join(config.reposClonePath, `cf-prod-${ticket.id}`);
          if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true });
          fs.mkdirSync(distDir, { recursive: true });

          for (const file of codingFiles) {
            const filePath = path.resolve(distDir, file.path);
            if (!filePath.startsWith(path.resolve(distDir) + path.sep) && filePath !== path.resolve(distDir)) continue;
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, file.content, 'utf-8');
          }

          const result = await cloudflarePages.deploy(
            cf.accountId,
            deployConfig.cf_project_name,
            distDir,
            cf.token,
            'main', // production branch
          );

          try { fs.rmSync(distDir, { recursive: true }); } catch { /* ignore */ }

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
}

/**
 * Rollback — create a revert commit on master.
 */
async function rollback(ticket: Ticket): Promise<void> {
  emitTicketLog(ticket.id, 'Rollback en cours (simulation)...', 'warning', 'deploying');
  // In a real setup, this would create a revert commit via git or the provider's API
  emitTicketLog(ticket.id, 'Rollback terminé', 'success', 'deploying');
}

export { deployToStaging, mergeToProduction, closePR, rollback };
