import crypto from 'crypto';
import { URL } from 'url';
import { promises as dnsPromises } from 'dns';
import net from 'net';
import logger from './logger';
import * as repo from '../db/repositories';

/** Check if an IP belongs to a private/internal range (SSRF protection) */
function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (localhost)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local / cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0
    if (parts.every(p => p === 0)) return true;
    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();
    // Loopback / unspecified
    if (normalized === '::1' || normalized === '::') return true;
    // Unique local addresses fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // Link-local fe80::/10
    const firstHextet = normalized.split(':')[0];
    if (/^fe[89ab]/.test(firstHextet)) return true;
    // IPv4-mapped IPv6 addresses
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length);
      return isPrivateIp(mapped);
    }
    return false;
  }

  // Unknown/invalid IP format -> deny
  return true;
}

function isLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'localhost' || lower === '0.0.0.0' || lower === '[::1]' || lower.endsWith('.local');
}

/** Validate that a webhook URL is not targeting internal/private resources.
 *  Returns the first safe resolved IP, or null if blocked. */
async function resolveAndValidateUrl(urlStr: string): Promise<{ ip: string; parsed: URL } | null> {
  try {
    const parsed = new URL(urlStr);
    // Only allow HTTPS to avoid plaintext webhook delivery
    if (parsed.protocol !== 'https:') return null;
    // Block localhost hostnames
    const hostname = parsed.hostname;
    if (!hostname || isLocalHostname(hostname)) return null;

    // Block direct private IP targets
    if (net.isIP(hostname) && isPrivateIp(hostname)) return null;

    // Resolve DNS and reject if any resolved address is private/internal
    const resolved = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length) return null;
    if (resolved.some(r => isPrivateIp(r.address))) return null;

    return { ip: resolved[0].address, parsed };
  } catch {
    return null;
  }
}

export async function dispatchWebhooks(projectId: number, event: string, payload: Record<string, unknown>): Promise<void> {
  // Find all enabled webhooks for this project + event
  const webhooks = repo.findUserWebhooksByEvent(projectId, event);

  for (const webhook of webhooks) {
    try {
      // SSRF protection: resolve DNS once and validate before fetch
      const resolved = await resolveAndValidateUrl(webhook.url);
      if (!resolved) {
        logger.warn(`Webhook ${webhook.id} blocked — URL targets internal/private address: ${webhook.url}`);
        continue;
      }

      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

      // Build URL with resolved IP to prevent DNS rebinding
      const fetchUrl = new URL(resolved.parsed.toString());
      fetchUrl.hostname = net.isIP(resolved.ip) === 6 ? `[${resolved.ip}]` : resolved.ip;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'Host': resolved.parsed.host,
      };

      // HMAC-SHA256 signature if secret is set
      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      // Fire and forget with 5s timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(fetchUrl.toString(), {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        redirect: 'error',
      });

      clearTimeout(timeout);

      if (!res.ok) {
        logger.warn(`Webhook ${webhook.id} to ${webhook.url} returned ${res.status}`);
      }
    } catch (err) {
      logger.error(`Webhook ${webhook.id} dispatch failed:`, err);
    }
  }
}
