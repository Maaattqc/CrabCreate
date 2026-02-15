import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import config from '../config';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';
import { validate } from '../middleware/validate';
import { requestCodeSchema, verifyCodeSchema, preferencesSchema } from '../schemas';
import { sendAuthCode } from '../services/email';
import { requireAuth, type JwtPayload } from '../middleware/auth';
import logger from '../services/logger';
import type { UserPreferences } from '../types';

const router = Router();
const MAX_AUTH_CODE_ATTEMPTS = 3;
const DEV_LOGIN_ROUTE_ENVS = new Set(['development', 'test']);
const FORWARDED_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'forwarded'] as const;

function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isLoopbackIp(ip: string): boolean {
  const normalized = normalizeIp(ip.trim().toLowerCase());
  return normalized === '127.0.0.1' || normalized === '::1';
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]' || normalized === '::1';
}

function parseHostHeader(hostHeader: string): string {
  const raw = hostHeader.trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const idx = raw.indexOf(']');
    return idx > 0 ? raw.slice(0, idx + 1) : raw;
  }
  return raw.split(':')[0];
}

function isLoopbackUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

function trustProxyEnabled(): boolean {
  return config.trustProxy !== 0 && config.trustProxy !== false;
}

function canRegisterDevLoginRoutes(): boolean {
  return DEV_LOGIN_ROUTE_ENVS.has(config.nodeEnv) && !trustProxyEnabled();
}

function hasForwardedHeaders(req: Request): boolean {
  return FORWARDED_HEADERS.some((header) => {
    const value = req.headers[header];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function isDevLoginEnabled(): boolean {
  if (!canRegisterDevLoginRoutes()) return false;

  const configured = repo.getConfig('dev_login_enabled');
  if (configured !== undefined) {
    return configured === '1';
  }
  // Default: enabled in dev/test (routes already restricted to localhost + dev/test env)
  return DEV_LOGIN_ROUTE_ENVS.has(config.nodeEnv);
}

function ensureDevLoginAccess(req: Request, res: Response): boolean {
  if (!isDevLoginEnabled()) {
    res.status(403).json({ error: 'Dev login disabled by administrator.' });
    return false;
  }

  if (hasForwardedHeaders(req)) {
    logger.security('dev_login_blocked_forwarded_headers', {
      host: req.headers.host || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null,
      ip: req.ip,
      socketIp: req.socket.remoteAddress || null,
    });
    res.status(403).json({ error: 'Dev login is unavailable behind a proxy.' });
    return false;
  }

  const host = typeof req.headers.host === 'string' ? parseHostHeader(req.headers.host) : '';
  if (!host || !isLoopbackHost(host)) {
    logger.security('dev_login_blocked_host', {
      hostHeader: req.headers.host || null,
      origin: req.headers.origin || null,
      referer: req.headers.referer || null,
      ip: req.ip,
    });
    res.status(403).json({ error: 'Dev login allowed from localhost only.' });
    return false;
  }

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (origin && !isLoopbackUrl(origin)) {
    logger.security('dev_login_blocked_origin', {
      hostHeader: req.headers.host || null,
      origin,
      ip: req.ip,
    });
    res.status(403).json({ error: 'Dev login allowed from localhost only.' });
    return false;
  }

  const referer = typeof req.headers.referer === 'string' ? req.headers.referer : '';
  if (referer && !isLoopbackUrl(referer)) {
    logger.security('dev_login_blocked_referer', {
      hostHeader: req.headers.host || null,
      referer,
      ip: req.ip,
    });
    res.status(403).json({ error: 'Dev login allowed from localhost only.' });
    return false;
  }

  // Check both proxy-resolved IP and raw TCP socket to prevent X-Forwarded-For spoofing
  const proxyIp = req.ip || '';
  const socketIp = req.socket.remoteAddress || '';
  if (!isLoopbackIp(proxyIp) || !isLoopbackIp(socketIp)) {
    logger.security('dev_login_blocked_non_loopback_ip', {
      proxyIp,
      socketIp,
      hostHeader: req.headers.host || null,
      origin: req.headers.origin || null,
    });
    res.status(403).json({ error: 'Dev login allowed from localhost only.' });
    return false;
  }

  return true;
}

function clientRateKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown';
  return `${ip}:${email}`;
}

// Rate limiters â€” window static (requires restart), limit dynamic
const requestCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => parseInt(repo.getConfig('auth_code_limit') || '5', 10),
  store: createRateLimitStore('auth_request_code'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: clientRateKey,
  message: { error: 'Trop de demandes de code. RÃ©essayez plus tard.' },
});

const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => parseInt(repo.getConfig('auth_verify_limit') || '10', 10),
  store: createRateLimitStore('auth_verify_code'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: clientRateKey,
  message: { error: 'Trop de tentatives. RÃ©essayez plus tard.' },
});

function generateCode(): string {
  return crypto.randomInt(10000000, 100000000).toString();
}

function getSessionDurationDays(): number {
  const val = repo.getConfig('session_duration_days');
  return val ? parseInt(val, 10) : 30;
}

function getSessionDurationSeconds(): number {
  return getSessionDurationDays() * 24 * 60 * 60;
}

function signToken(payload: JwtPayload): { token: string; maxAgeMs: number } {
  const expiresInSec = getSessionDurationSeconds();
  const token = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS512', expiresIn: expiresInSec });
  return { token, maxAgeMs: expiresInSec * 1000 };
}

function setAuthCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie('crab_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: '/',
  });
}

function parsePreferences(raw: string | null | undefined): UserPreferences {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function detectLang(req: Request, email: string): 'fr' | 'en' {
  // Check stored preferences first
  const user = repo.findUserByEmail(email);
  if (user) {
    const prefs = parsePreferences(user.preferences);
    if (prefs.lang) return prefs.lang;
  }
  // Fall back to Accept-Language header
  const accept = req.headers['accept-language'] || '';
  if (accept.toLowerCase().startsWith('fr')) return 'fr';
  if (accept.toLowerCase().startsWith('en')) return 'en';
  return 'fr';
}

function userResponse(user: { id: number; email: string; is_admin: number; plan?: string; stripe_subscription_status?: string | null; preferences: string }) {
  return {
    id: user.id,
    email: user.email,
    isAdmin: user.is_admin === 1,
    isVisitor: /^new-client-\d+@crabcreate\.dev$/.test(user.email),
    plan: user.plan || 'free',
    stripeSubscriptionStatus: user.stripe_subscription_status || null,
    preferences: parsePreferences(user.preferences),
  };
}

// POST /api/auth/request-code
router.post('/request-code', requestCodeLimiter, validate(requestCodeSchema), async (req: Request, res: Response) => {
  // Check if registration is enabled (existing users can still log in)
  const { email } = req.body;
  const codeLimit = parseInt(repo.getConfig('auth_code_limit') || '5', 10);
  const codeWindowMinutes = parseInt(repo.getConfig('auth_code_window_minutes') || '15', 10);
  // Always perform the same operations to prevent user enumeration via timing
  const existingUser = repo.findUserByEmail(email);
  const recent = repo.countRecentAuthCodes(email, codeWindowMinutes);
  const registrationDisabled = !existingUser && repo.getConfig('registration_enabled') === '0';

  if (!registrationDisabled && recent < codeLimit) {
    repo.invalidateAuthCodes(email);

    const code = generateCode();
    const codeExpiryMinutes = parseInt(repo.getConfig('auth_code_expiry_minutes') || '10', 10);
    const expiresAt = new Date(Date.now() + codeExpiryMinutes * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
    repo.createAuthCode(email, code, expiresAt);

    const lang = detectLang(req, email);
    sendAuthCode(email, code, lang).catch(err => { logger.warn('[Auth] Failed to send auth code email:', err); });
  }

  res.json({ message: 'Si cette adresse est valide, un code a Ã©tÃ© envoyÃ©.' });
});

// POST /api/auth/verify-code
router.post('/verify-code', verifyCodeLimiter, validate(verifyCodeSchema), (req: Request, res: Response) => {
  const { email, code } = req.body;

  const latestCode = repo.findLatestAuthCode(email);

  if (!latestCode) {
    res.status(400).json({ error: 'Code invalide ou expirÃ©.' });
    return;
  }

  const nextAttempts = latestCode.attempts + 1;
  repo.incrementAuthCodeAttempts(latestCode.id);

  if (nextAttempts > MAX_AUTH_CODE_ATTEMPTS) {
    repo.markAuthCodeUsed(latestCode.id);
    res.status(400).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
    return;
  }

  const codeMatch = repo.isAuthCodeMatch(latestCode.code, code);
  if (!codeMatch) {
    if (nextAttempts >= MAX_AUTH_CODE_ATTEMPTS) {
      repo.markAuthCodeUsed(latestCode.id);
      res.status(400).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
      return;
    }
    res.status(400).json({ error: 'Code invalide ou expirÃ©.' });
    return;
  }

  repo.markAuthCodeUsed(latestCode.id);

  let user = repo.findUserByEmail(email);
  if (!user) {
    // First user ever is admin only if email matches ADMIN_EMAIL
    const isFirstUser = repo.countUsers() === 0;
    user = repo.createUser(email);
    if (isFirstUser && config.adminEmail && email.toLowerCase() === config.adminEmail.toLowerCase()) {
      repo.setUserAdmin(user.id, true);
      user = repo.findUserById(user.id)!;
    }
  }
  repo.updateUserLastLogin(user.id);
  repo.clearTokenInvalidation(user.id);

  const payload: JwtPayload = { userId: user.id, email: user.email };
  const { token, maxAgeMs } = signToken(payload);

  setAuthCookie(res, token, maxAgeMs);
  repo.insertAuditLog(user.id, user.email, 'login', 'user', user.id, 'Email code verification', req.ip);
  res.json({ user: userResponse(user) });
});

// Dev-login routes â€” only registered for local development/test without trusted proxy
if (canRegisterDevLoginRoutes()) {
  // POST /api/auth/dev-login â€” auto-login with ADMIN_EMAIL
  router.post('/dev-login', (req: Request, res: Response) => {
    if (!ensureDevLoginAccess(req, res)) return;

    const adminEmail = config.adminEmail;
    if (!adminEmail) {
      res.status(400).json({ error: 'Dev login unavailable' });
      return;
    }

    let user = repo.findUserByEmail(adminEmail);
    if (!user) {
      user = repo.createUser(adminEmail);
      repo.setUserAdmin(user.id, true);
      user = repo.findUserById(user.id)!;
    }
    repo.updateUserLastLogin(user.id);
    repo.clearTokenInvalidation(user.id);

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const { token, maxAgeMs } = signToken(payload);

    setAuthCookie(res, token, maxAgeMs);
    repo.insertAuditLog(user.id, user.email, 'dev_login', 'user', user.id, 'Dev admin login', req.ip);
    res.json({ user: userResponse(user) });
  });

  // POST /api/auth/dev-login-client â€” auto-login as regular user
  router.post('/dev-login-client', (req: Request, res: Response) => {
    if (!ensureDevLoginAccess(req, res)) return;

    const clientEmail = 'client-demo@crabcreate.dev';
    let user = repo.findUserByEmail(clientEmail);
    if (!user) {
      user = repo.createUser(clientEmail);
      user = repo.findUserById(user.id)!;
    }
    repo.updateUserLastLogin(user.id);
    repo.clearTokenInvalidation(user.id);

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const { token, maxAgeMs } = signToken(payload);

    setAuthCookie(res, token, maxAgeMs);
    repo.insertAuditLog(user.id, user.email, 'dev_login', 'user', user.id, 'Dev client login', req.ip);
    res.json({ user: userResponse(user) });
  });

  // POST /api/auth/dev-login-new â€” create a fresh client each time
  router.post('/dev-login-new', (req: Request, res: Response) => {
    if (!ensureDevLoginAccess(req, res)) return;

    const timestamp = Date.now();
    const newEmail = `new-client-${timestamp}@crabcreate.dev`;
    let user = repo.createUser(newEmail);
    user = repo.findUserById(user.id)!;
    repo.updateUserLastLogin(user.id);
    repo.clearTokenInvalidation(user.id);

    const payload: JwtPayload = { userId: user.id, email: user.email };
    const { token, maxAgeMs } = signToken(payload);

    setAuthCookie(res, token, maxAgeMs);
    repo.insertAuditLog(user.id, user.email, 'dev_login', 'user', user.id, 'Dev new client login', req.ip);
    res.json({ user: userResponse(user) });
  });
} else if (DEV_LOGIN_ROUTE_ENVS.has(config.nodeEnv)) {
  logger.security('dev_login_routes_disabled_due_to_trust_proxy', { trustProxy: config.trustProxy });
}

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Invalidate all existing tokens for this user
  const token = req.cookies?.crab_token;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS512'] }) as JwtPayload;
      repo.invalidateUserTokens(payload.userId);
    } catch { /* token already expired, ignore */ }
  }

  res.clearCookie('crab_token', {
    path: '/',
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
  });
  res.json({ message: 'DÃ©connectÃ©' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = repo.findUserById(req.user!.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  res.json({ user: userResponse(user) });
});

// PUT /api/auth/preferences (protected)
router.put('/preferences', requireAuth, validate(preferencesSchema), (req: Request, res: Response) => {
  const user = repo.findUserById(req.user!.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const current = parsePreferences(user.preferences);
  const { lang, theme, animations, aiDesign, mascot } = req.body;

  if (lang !== undefined) current.lang = lang;
  if (theme !== undefined) current.theme = theme;
  if (animations !== undefined) current.animations = animations;
  if (aiDesign !== undefined) current.aiDesign = aiDesign;
  if (mascot !== undefined) current.mascot = mascot;

  repo.updateUserPreferences(user.id, JSON.stringify(current));
  res.json({ preferences: current });
});

export default router;

