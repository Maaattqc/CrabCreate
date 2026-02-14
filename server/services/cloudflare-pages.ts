import axios from 'axios';
import { execSync } from 'child_process';
import logger from './logger';

const CF_API = 'https://api.cloudflare.com/client/v4';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create a Cloudflare Pages project.
 */
export async function createProject(
  accountId: string,
  name: string,
  token: string,
): Promise<{ name: string; url: string }> {
  const res = await axios.post(
    `${CF_API}/accounts/${accountId}/pages/projects`,
    {
      name,
      production_branch: 'main',
    },
    { headers: headers(token) },
  );

  const project = res.data.result;
  return {
    name: project.name,
    url: project.subdomain ? `https://${project.subdomain}` : `https://${name}.pages.dev`,
  };
}

/**
 * Deploy to Cloudflare Pages via direct upload using Wrangler CLI.
 */
export async function deploy(
  accountId: string,
  projectName: string,
  distDir: string,
  token: string,
): Promise<{ url: string }> {
  try {
    const output = execSync(
      `npx wrangler pages deploy "${distDir}" --project-name="${projectName}"`,
      {
        env: { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId },
        encoding: 'utf-8',
        timeout: 120_000,
      },
    );

    // Extract URL from wrangler output
    const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/);
    return { url: urlMatch ? urlMatch[0] : `https://${projectName}.pages.dev` };
  } catch (err) {
    logger.error('[CloudflarePages] Deploy failed:', err);
    throw new Error('Cloudflare Pages deploy failed');
  }
}

/**
 * Delete a Cloudflare Pages project.
 */
export async function deleteProject(
  accountId: string,
  name: string,
  token: string,
): Promise<void> {
  await axios.delete(
    `${CF_API}/accounts/${accountId}/pages/projects/${name}`,
    { headers: headers(token) },
  );
}

/**
 * Add a custom domain to a Cloudflare Pages project.
 */
export async function addCustomDomain(
  accountId: string,
  projectName: string,
  domain: string,
  token: string,
): Promise<void> {
  await axios.post(
    `${CF_API}/accounts/${accountId}/pages/projects/${projectName}/domains`,
    { name: domain },
    { headers: headers(token) },
  );
}
