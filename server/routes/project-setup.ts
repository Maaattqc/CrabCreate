import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { connectRepoSchema, createRepoSchema } from '../schemas';
import { createGitProvider, buildCloneUrl } from '../services/git-providers';
import * as cloudflarePages from '../services/cloudflare-pages';
import * as supabase from '../services/supabase';
import { hasMinRole } from '../permissions';
import logger from '../services/logger';
import { isAutoRepoConfigured, autoCreateRepo } from '../services/auto-repo';

const router = Router();

function requireProjectAdmin(req: Request, res: Response): boolean {
  if (!hasMinRole(req.project!.userRole, 'admin')) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

/** For credential-sensitive operations (connect-repo, create-repo), require actual project membership.
 *  Global admins who are not project members cannot store credentials on behalf of a project. */
function requireProjectMemberAdmin(req: Request, res: Response): boolean {
  const member = repo.findProjectMember(req.project!.id, req.user!.userId);
  if (!member || !hasMinRole(member.role, 'admin')) {
    res.status(403).json({ error: 'Project admin membership required' });
    return false;
  }
  return true;
}

// GET /api/projects/:id/setup/status
router.get('/status', (req: Request, res: Response) => {
  const status = repo.getProjectSetupStatus(req.project!.id);
  res.json(status);
});

// POST /api/projects/:id/setup/test-connection
router.post('/test-connection', async (req: Request, res: Response) => {
  if (!requireProjectMemberAdmin(req, res)) return;

  const { provider, token, owner, repo: repoName } = req.body;
  if (!provider || !token) {
    return res.status(400).json({ error: 'Provider and token are required' });
  }

  try {
    const gitProvider = createGitProvider(provider, token, owner || '', repoName || '');
    const valid = await gitProvider.validateToken();
    if (!valid) {
      return res.json({ success: false, error: 'Token invalide ou expiré' });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error('[ProjectSetup] test-connection error:', err);
    res.json({ success: false, error: (err as Error).message || 'Connection failed' });
  }
});

// POST /api/projects/:id/setup/connect-repo
router.post('/connect-repo', validate(connectRepoSchema), async (req: Request, res: Response) => {
  if (!requireProjectMemberAdmin(req, res)) return;

  const { provider, owner, repo: repoName, token, branch, target_branch } = req.body;
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
      default_branch: branch || 'master',
      target_branch: target_branch || 'develop',
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
    res.status(500).json({ error: 'Setup operation failed' });
  }
});

// POST /api/projects/:id/setup/create-repo
router.post('/create-repo', validate(createRepoSchema), async (req: Request, res: Response) => {
  if (!requireProjectMemberAdmin(req, res)) return;

  const { provider, token, repoName, isPrivate, target_branch } = req.body;
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
      target_branch: target_branch || 'develop',
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
    res.status(500).json({ error: 'Setup operation failed' });
  }
});

// POST /api/projects/:id/setup/configure-deploy
router.post('/configure-deploy', async (req: Request, res: Response) => {
  if (!requireProjectAdmin(req, res)) return;

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
    res.status(500).json({ error: 'Setup operation failed' });
  }
});

// POST /api/projects/:id/setup/auto-repo — auto-create GitHub repo using env vars
router.post('/auto-repo', async (req: Request, res: Response) => {
  if (!requireProjectAdmin(req, res)) return;
  if (!isAutoRepoConfigured()) {
    return res.status(400).json({ error: 'Auto-repo not configured' });
  }
  const project = req.project!;
  try {
    const result = await autoCreateRepo(project.id, project.slug, true);
    if (!result.success) return res.status(500).json({ error: result.error });
    repo.updateProjectSetup(project.id, true);
    repo.insertAuditLog(req.user!.userId, req.user!.email, 'auto_repo_create', 'project', project.id, project.slug);
    res.json({ success: true, webUrl: result.webUrl });
  } catch (err) {
    logger.error('[ProjectSetup] auto-repo error:', err);
    res.status(500).json({ error: 'Auto-repo creation failed' });
  }
});

// POST /api/projects/:id/setup/skip-deploy
router.post('/skip-deploy', (req: Request, res: Response) => {
  if (!requireProjectAdmin(req, res)) return;

  const projectId = req.project!.id;
  repo.updateProjectSetup(projectId, true);
  repo.insertAuditLog(req.user!.userId, req.user!.email, 'setup_skip_deploy', 'project', projectId);
  res.json({ success: true });
});

export default router;
