import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../services/logger';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  try {
    const url = new URL(config.clientUrl);
    origins.add(url.origin);

    // Local development convenience: allow equivalent loopback aliases on same port.
    if (isLoopbackHostname(url.hostname)) {
      const port = url.port ? `:${url.port}` : '';
      origins.add(`${url.protocol}//localhost${port}`);
      origins.add(`${url.protocol}//127.0.0.1${port}`);
      origins.add(`${url.protocol}//[::1]${port}`);
    }
  } catch {
    // Ignore invalid CLIENT_URL, enforcement will fall back to deny in production.
  }
  return origins;
}

function extractRequestOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) {
    return origin;
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (config.nodeEnv === 'test') {
    next();
    return;
  }

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const fetchSite = req.headers['sec-fetch-site'];
  if (typeof fetchSite === 'string' && fetchSite.toLowerCase() === 'cross-site') {
    logger.security('csrf_blocked_fetch_site', {
      method: req.method,
      path: req.path,
      fetchSite,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null,
      ip: req.ip,
    });
    res.status(403).json({ error: 'CSRF protection: cross-site request blocked' });
    return;
  }

  // External providers call these endpoints server-to-server.
  if (req.path === '/webhooks' || req.path.startsWith('/webhooks/')) {
    next();
    return;
  }

  const sourceOrigin = extractRequestOrigin(req);
  const allowedOrigins = getAllowedOrigins();

  if (!sourceOrigin) {
    logger.security('csrf_blocked_missing_origin', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null,
      ip: req.ip,
    });
    res.status(403).json({ error: 'CSRF protection: missing origin' });
    return;
  }

  if (!allowedOrigins.has(sourceOrigin)) {
    logger.security('csrf_blocked_invalid_origin', {
      method: req.method,
      path: req.path,
      sourceOrigin,
      ip: req.ip,
    });
    res.status(403).json({ error: 'CSRF protection: invalid origin' });
    return;
  }

  next();
}
