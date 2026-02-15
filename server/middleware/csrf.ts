import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../services/logger';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  try {
    origins.add(new URL(config.clientUrl).origin);
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

  // External providers call these endpoints server-to-server.
  if (req.path === '/webhooks' || req.path.startsWith('/webhooks/')) {
    next();
    return;
  }

  const sourceOrigin = extractRequestOrigin(req);
  const allowedOrigins = getAllowedOrigins();

  if (!sourceOrigin) {
    logger.warn(`[Security] CSRF blocked: missing Origin/Referer on ${req.method} ${req.path}`);
    res.status(403).json({ error: 'CSRF protection: missing origin' });
    return;
  }

  if (!allowedOrigins.has(sourceOrigin)) {
    logger.warn(`[Security] CSRF blocked: origin ${sourceOrigin} not allowed for ${req.method} ${req.path}`);
    res.status(403).json({ error: 'CSRF protection: invalid origin' });
    return;
  }

  next();
}
