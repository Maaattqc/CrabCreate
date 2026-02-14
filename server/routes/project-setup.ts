import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { connectRepoSchema, createRepoSchema } from '../schemas';
import { createGitProvider, buildCloneUrl } from '../services/git-providers';
import * as cloudflarePages from '../services/cloudflare-pages';
import * as supabase from '../services/supabase';
import logger from '../services/logger';

const router = Router();

// GET /api/projects/:id/setup/status
router.get('/status', (req: Request, res: Response) => {
  const status = repo.getProjectSetupStatus(req.project!.id);
  res.json(status);
});

// POST /api/projects/:id/setup/connect-repo
router.post('/connect-repo', validate(connectRepoSchema), async (req: Request, res: Response) => {
  const { provider, owner, repo: repoName, token, branch } = req.body;
  const projectId = req.project!.id;

  try {
    // Validate token
    const gitProvider = createGitProvider(provider, token, owner, repoName);
    const valid = await gitProvider.validateToken();
    if (!valid) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    // Build clone URL
    const cloneUrl = buildCloneUrl(provider, token, owner, repoName);
    const repoId = `proj-${projectId}`;

    // Create or update repo
    repo.createOrUpdateRepo(repoId, {
      label: `${owner}/${repoName}`,
      git_provider: provider as 'github' | 'gitlab' | 'bitbucket',
      provider_owner: owner,
      provider_repo: repoName,
      provider_token: token,
      clone_url: cloneUrl,
      default_branch: branch || 'main',
      // Also set bitbucket fields for backward compat
      bitbucket_workspace: provider === 'bitbucket' ? owner : '',
      bitbucket_repo_slug: provider === 'bitbucket' ? repoName : '',
    });

    // Update project
    const project = repo.findProjectById(projectId);
    if (project) {
      repo.updateProject(projectId, { default_repo: repoId });
    }
    repo.updateProjectSetup(projectId, true);

    repo.insertAuditLog(req.user!.userId, req.user!.email, 'setup_connect_repo', 'project', projectId, `${provider}:${owner}/${repoName}`);
    res.json({ success: true, repoId });
  } catch (err) {
    logger.error('[ProjectSetup] connect-repo error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:id/setup/create-repo
router.post('/create-repo', validate(createRepoSchema), async (req: Request, res: Response) => {
  const { provider, token, repoName, isPrivate } = req.body;
  const projectId = req.project!.id;

  try {
    // Use user email as owner hint for auto-detection
    const gitProvider = createGitProvider(provider, token, req.user!.email.split('@')[0], '');
    const result = await gitProvider.createRepo(repoName, isPrivate);

    // Extract owner from clone URL
    let owner = '';
    try {
      const url = new URL(result.cloneUrl.replace(/\.git$/, ''));
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        owner = parts[0];
      }
    } catch {
      owner = req.user!.email.split('@')[0];
    }

    const cloneUrl = buildCloneUrl(provider, token, owner, repoName);
    const repoId = `proj-${projectId}`;

    repo.createOrUpdateRepo(repoId, {
      label: `${owner}/${repoName}`,
      git_provider: provider as 'github' | 'gitlab' | 'bitbucket',
      provider_owner: owner,
      provider_repo: repoName,
      provider_token: token,
      clone_url: cloneUrl,
      default_branch: 'main',
      bitbucket_workspace: provider === 'bitbucket' ? owner : '',
      bitbucket_repo_slug: provider === 'bitbucket' ? repoName : '',
    });

    const project = repo.findProjectById(projectId);
    if (project) {
      repo.updateProject(projectId, { default_repo: repoId });
    }
    repo.updateProjectSetup(projectId, true);

    repo.insertAuditLog(req.user!.userId, req.user!.email, 'setup_create_repo', 'project', projectId, `${provider}:${owner}/${repoName}`);
    res.json({ success: true, repoId, webUrl: result.webUrl });
  } catch (err) {
    logger.error('[ProjectSetup] create-repo error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:id/setup/configure-deploy
router.post('/configure-deploy', async (req: Request, res: Response) => {
  const cfApiToken = process.env.CF_API_TOKEN;
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  if (!cfApiToken || !cfAccountId) {
    return res.status(500).json({ error: 'Cloudflare credentials not configured (CF_API_TOKEN / CF_ACCOUNT_ID)' });
  }

  const projectId = req.project!.id;
  const project = repo.findProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    // Create Cloudflare Pages project
    const cfProjectName = `crab-${project.slug}`;
    const cfResult = await cloudflarePages.createProject(cfAccountId, cfProjectName, cfApiToken);

    // Generate supabase tenant ID
    const tenantId = crypto.randomUUID();

    // Provision tenant in Supabase
    await supabase.provisionTenant({
      tenantId,
      projectId,
      projectName: project.name,
      ownerEmail: req.user!.email,
    });

    // Store deploy config
    const existing = repo.findDeployConfigByProject(projectId);
    if (existing) {
      repo.updateDeployConfig(projectId, {
        cf_project_name: cfResult.name,
        cf_site_url: cfResult.url,
        cf_api_token: cfApiToken,
        cf_account_id: cfAccountId,
        supabase_tenant_id: tenantId,
      });
    } else {
      repo.createDeployConfig(projectId, {
        cf_project_name: cfResult.name,
        cf_site_url: cfResult.url,
        cf_api_token: cfApiToken,
        cf_account_id: cfAccountId,
        supabase_tenant_id: tenantId,
      });
    }

    repo.insertAuditLog(req.user!.userId, req.user!.email, 'setup_configure_deploy', 'project', projectId, cfResult.name);
    res.json({ success: true, siteUrl: cfResult.url, tenantId });
  } catch (err) {
    logger.error('[ProjectSetup] configure-deploy error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:id/setup/skip-deploy
router.post('/skip-deploy', (req: Request, res: Response) => {
  const projectId = req.project!.id;
  repo.updateProjectSetup(projectId, true);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'setup_skip_deploy', 'project', projectId);
  res.json({ success: true });
});

export default router;
