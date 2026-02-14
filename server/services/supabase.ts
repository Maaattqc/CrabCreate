import logger from './logger';

// ── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getHeaders(): Record<string, string> {
  return {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

function getRestUrl(table: string): string {
  return `${SUPABASE_URL}/rest/v1/${table}`;
}

function assertConfigured(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase credentials not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
}

// ── SQL for tenants table (run once in Supabase SQL Editor) ────────────────

/**
 * SQL to create the tenants table. Run this ONCE in the Supabase SQL Editor:
 *
 * CREATE TABLE IF NOT EXISTS tenants (
 *   id UUID PRIMARY KEY,
 *   project_id INTEGER NOT NULL UNIQUE,
 *   project_name TEXT NOT NULL,
 *   owner_email TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   active BOOLEAN DEFAULT TRUE
 * );
 * CREATE INDEX IF NOT EXISTS idx_tenants_project_id ON tenants (project_id);
 */
export const TENANTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_tenants_project_id ON tenants (project_id);
`;

// ── Tenant provisioning ────────────────────────────────────────────────────

export interface TenantInfo {
  tenantId: string;
  projectId: number;
  projectName: string;
  ownerEmail: string;
}

/**
 * Provision a new tenant in Supabase via REST API.
 * Upserts a record in the tenants table (ON CONFLICT on project_id).
 */
export async function provisionTenant(info: TenantInfo): Promise<void> {
  assertConfigured();

  // Upsert: use PostgREST merge-duplicates resolution
  const res = await fetch(getRestUrl('tenants'), {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      id: info.tenantId,
      project_id: info.projectId,
      project_name: info.projectName,
      owner_email: info.ownerEmail,
      active: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase provisionTenant failed (${res.status}): ${body}`);
  }

  logger.info(`[Supabase] Tenant provisioned: ${info.tenantId} (project ${info.projectId})`);
}

/**
 * Deactivate a tenant (soft delete).
 */
export async function deactivateTenant(projectId: number): Promise<void> {
  assertConfigured();

  const res = await fetch(`${getRestUrl('tenants')}?project_id=eq.${projectId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ active: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase deactivateTenant failed (${res.status}): ${body}`);
  }

  logger.info(`[Supabase] Tenant deactivated for project ${projectId}`);
}

/**
 * Get a tenant by project_id.
 */
export async function getTenant(projectId: number): Promise<TenantInfo | null> {
  assertConfigured();

  const res = await fetch(`${getRestUrl('tenants')}?project_id=eq.${projectId}&limit=1`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase getTenant failed (${res.status}): ${body}`);
  }

  const rows = await res.json() as Record<string, unknown>[];
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    tenantId: row.id as string,
    projectId: row.project_id as number,
    projectName: row.project_name as string,
    ownerEmail: row.owner_email as string,
  };
}

/**
 * Check if the Supabase REST API is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    assertConfigured();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}
