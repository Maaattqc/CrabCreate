import { hash as blake3hash } from 'blake3-wasm';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import logger from './logger';

const CF_API = 'https://api.cloudflare.com/client/v4';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** Simple MIME type lookup by extension. */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.map': 'application/json',
    '.webmanifest': 'application/manifest+json',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Compute the CF Pages hash for a file: BLAKE3(base64(content) + extension).hex().slice(0, 32)
 * This matches wrangler's hashFile() implementation.
 */
function hashFileContent(content: Buffer, filePath: string): string {
  const base64Content = content.toString('base64');
  const extension = path.extname(filePath).substring(1); // without dot
  return blake3hash(base64Content + extension).toString('hex').slice(0, 32);
}

/**
 * Recursively collect all files from a directory.
 */
function collectFiles(dir: string, prefix = ''): {
  filePath: string;    // e.g. "/index.html"
  content: Buffer;
  hash: string;        // 32-char hex BLAKE3
  contentType: string;
}[] {
  const results: { filePath: string; content: Buffer; hash: string; contentType: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relativePath));
    } else {
      const content = fs.readFileSync(fullPath);
      const cfPath = `/${relativePath.replace(/\\/g, '/')}`;
      const hash = hashFileContent(content, cfPath);
      const contentType = getMimeType(cfPath);
      results.push({ filePath: cfPath, content, hash, contentType });
    }
  }
  return results;
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
    { headers: authHeaders(token) },
  );

  const project = res.data.result;
  return {
    name: project.name,
    url: project.subdomain ? `https://${project.subdomain}` : `https://${name}.pages.dev`,
  };
}

/**
 * Step 1: Get upload JWT from CF Pages (GET, not POST).
 */
async function getUploadToken(
  accountId: string,
  projectName: string,
  token: string,
): Promise<string> {
  logger.info(`[CF] Step 1: Getting upload token for ${projectName}...`);
  const res = await axios.get(
    `${CF_API}/accounts/${accountId}/pages/projects/${projectName}/upload-token`,
    { headers: authHeaders(token) },
  );
  const jwt = res.data?.result?.jwt;
  if (!jwt) throw new Error('No JWT returned from upload-token endpoint');
  logger.info(`[CF] Upload token received (${jwt.length} chars)`);
  return jwt;
}

/**
 * Step 2: Check which file hashes CF already has.
 */
async function checkMissing(hashes: string[], jwt: string): Promise<string[]> {
  logger.info(`[CF] Step 2: Checking ${hashes.length} hashes for missing assets...`);
  const res = await axios.post(
    `${CF_API}/pages/assets/check-missing`,
    { hashes },
    { headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' } },
  );
  const missing: string[] = res.data?.result || [];
  logger.info(`[CF] ${missing.length} of ${hashes.length} assets need uploading`);
  return missing;
}

/**
 * Step 3: Upload file contents as base64 JSON payloads.
 * CF expects: [{key: hash, value: base64content, metadata: {contentType}, base64: true}]
 */
async function uploadAssets(
  files: { hash: string; content: Buffer; contentType: string }[],
  jwt: string,
): Promise<void> {
  if (files.length === 0) {
    logger.info('[CF] Step 3: No assets to upload (all cached)');
    return;
  }

  // Upload in batches of 5 files
  const BATCH_SIZE = 5;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const payload = batch.map(f => ({
      key: f.hash,
      value: f.content.toString('base64'),
      metadata: { contentType: f.contentType },
      base64: true,
    }));

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    logger.info(`[CF] Step 3: Uploading batch ${batchNum} (${batch.length} files, ${batch.map(f => f.hash).join(', ')})...`);
    const res = await axios.post(
      `${CF_API}/pages/assets/upload`,
      payload,
      {
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );
    logger.info(`[CF] Batch ${batchNum} uploaded (status: ${res.status})`);
  }
}

/**
 * Step 4: Upsert all hashes to finalize the upload session.
 */
async function upsertHashes(hashes: string[], jwt: string): Promise<void> {
  logger.info(`[CF] Step 4: Upserting ${hashes.length} hashes...`);
  const res = await axios.post(
    `${CF_API}/pages/assets/upsert-hashes`,
    { hashes },
    { headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' } },
  );
  logger.info(`[CF] Hashes upserted (status: ${res.status})`);
}

/**
 * Step 5: Create deployment with manifest (multipart form-data).
 */
async function createDeployment(
  accountId: string,
  projectName: string,
  manifest: Record<string, string>,
  branch: string,
  token: string,
): Promise<{ url: string; environment: string; id: string }> {
  logger.info(`[CF] Step 5: Creating deployment for ${projectName} (branch: ${branch}, ${Object.keys(manifest).length} files)...`);

  const form = new FormData();
  form.append('manifest', JSON.stringify(manifest));
  form.append('branch', branch);

  const res = await axios.post(
    `${CF_API}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
      timeout: 120_000,
    },
  );

  const deployment = res.data?.result;
  const url = deployment?.url || `https://${projectName}.pages.dev`;
  const environment = deployment?.environment || 'unknown';
  const id = deployment?.id || '';

  logger.info(`[CF] Deployment created: ${url} (env: ${environment}, id: ${id})`);
  return { url, environment, id };
}

/**
 * Deploy to Cloudflare Pages via Direct Upload API.
 * 5-step process: upload-token → check-missing → upload → upsert → deploy.
 */
export async function deploy(
  accountId: string,
  projectName: string,
  distDir: string,
  token: string,
  branch = 'main',
): Promise<{ url: string }> {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
    throw new Error('Invalid project name');
  }
  const resolvedDist = path.resolve(distDir);

  // Collect all files with BLAKE3 hashes
  const files = collectFiles(resolvedDist);
  if (files.length === 0) {
    throw new Error('No files to deploy');
  }

  // Build manifest: { "/path/to/file": "blake3hash32", ... }
  const manifest: Record<string, string> = {};
  for (const file of files) {
    manifest[file.filePath] = file.hash;
  }

  logger.info(`[CF] === Starting deploy to ${projectName} (branch: ${branch}) ===`);
  logger.info(`[CF] Files: ${files.map(f => `${f.filePath} (${f.hash}, ${f.content.length}B, ${f.contentType})`).join(', ')}`);

  try {
    // Step 1: Get upload JWT (GET request)
    const jwt = await getUploadToken(accountId, projectName, token);

    // Step 2: Check which files are missing
    const allHashes = files.map(f => f.hash);
    const missingHashes = await checkMissing(allHashes, jwt);

    // Step 3: Upload missing files (base64 JSON)
    const missingSet = new Set(missingHashes);
    const filesToUpload = files.filter(f => missingSet.has(f.hash));
    await uploadAssets(filesToUpload, jwt);

    // Step 4: Upsert all hashes
    await upsertHashes(allHashes, jwt);

    // Step 5: Create deployment with manifest
    const deployment = await createDeployment(accountId, projectName, manifest, branch, token);

    logger.info(`[CF] === Deploy complete: ${deployment.url} ===`);
    return { url: deployment.url };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const errDetail = JSON.stringify(err.response.data, null, 2);
      logger.error(`[CF] Deploy failed (${err.response.status}): ${errDetail}`);
      throw new Error(`CF Pages deploy failed (${err.response.status}): ${JSON.stringify(err.response.data?.errors || err.response.data)}`);
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[CF] Deploy failed (non-axios): ${errMsg}`);
    throw new Error(`Cloudflare Pages deploy failed: ${errMsg}`);
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
    { headers: authHeaders(token) },
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
    { headers: authHeaders(token) },
  );
}
