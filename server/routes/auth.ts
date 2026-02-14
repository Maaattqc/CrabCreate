import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import config from '../config';
import * as repo from '../db/repositories';
import { validate } from '../middleware/validate';
import { requestCodeSchema, verifyCodeSchema } from '../schemas';
import { sendAuthCode } from '../services/email';
import { requireAuth, type JwtPayload } from '../middleware/auth';
import type { UserPreferences } from '../types';

const router = Router();

// Rate limiters — window static (requires restart), limit dynamic
const requestCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => parseInt(repo.getConfig('auth_code_limit') || '5', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.body?.email || 'unknown',
  message: { error: 'Trop de demandes de code. Réessayez plus tard.' },
});

const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => parseInt(repo.getConfig('auth_verify_limit') || '10', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSessionDurationDays(): number {
  const val = repo.getConfig('session_duration_days');
  return val ? parseInt(val, 10) : 30;
}

function setAuthCookie(res: Response, token: string): void {
  const days = getSessionDurationDays();
  res.cookie('crab_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: days * 24 * 60 * 60 * 1000,
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
    plan: user.plan || 'free',
    stripeSubscriptionStatus: user.stripe_subscription_status || null,
    preferences: parsePreferences(user.preferences),
  };
}

// POST /api/auth/request-code
router.post('/request-code', requestCodeLimiter, validate(requestCodeSchema), async (req: Request, res: Response) => {
  // Check if registration is enabled (existing users can still log in)
  const { email } = req.body;
  const existingUser = repo.findUserByEmail(email);
  if (!existingUser && repo.getConfig('registration_enabled') === '0') {
    res.status(403).json({ error: 'Les inscriptions sont désactivées.' });
    return;
  }

  const recent = repo.countRecentAuthCodes(email, 15);
  if (recent >= 5) {
    res.json({ message: 'Si cette adresse est valide, un code a été envoyé.' });
    return;
  }

  repo.invalidateAuthCodes(email);

  const code = generateCode();
  const codeExpiryMinutes = parseInt(repo.getConfig('auth_code_expiry_minutes') || '10', 10);
  const expiresAt = new Date(Date.now() + codeExpiryMinutes * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
  repo.createAuthCode(email, code, expiresAt);

  const lang = detectLang(req, email);
  sendAuthCode(email, code, lang).catch(() => {});

  res.json({ message: 'Si cette adresse est valide, un code a été envoyé.' });
});

// POST /api/auth/verify-code
router.post('/verify-code', verifyCodeLimiter, validate(verifyCodeSchema), (req: Request, res: Response) => {
  const { email, code } = req.body;

  const latestCode = repo.findLatestAuthCode(email);

  if (!latestCode) {
    res.status(400).json({ error: 'Code invalide ou expiré.' });
    return;
  }

  repo.incrementAuthCodeAttempts(latestCode.id);

  if (latestCode.attempts >= 5) {
    repo.markAuthCodeUsed(latestCode.id);
    res.status(400).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
    return;
  }

  if (latestCode.code !== code) {
    res.status(400).json({ error: 'Code invalide ou expiré.' });
    return;
  }

  repo.markAuthCodeUsed(latestCode.id);

  let user = repo.findUserByEmail(email);
  if (!user) {
    // First user ever is admin
    const isFirstUser = repo.countUsers() === 0;
    user = repo.createUser(email);
    if (isFirstUser) {
      repo.setUserAdmin(user.id, true);
      user = repo.findUserById(user.id)!;
    }
  }
  repo.updateUserLastLogin(user.id);

  const payload: JwtPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS512', expiresIn: `${getSessionDurationDays()}d` });

  setAuthCookie(res, token);
  repo.insertAuditLog(user.id, user.email, 'login', 'user', user.id, 'Email code verification', req.ip);
  res.json({ user: userResponse(user) });
});

// POST /api/auth/dev-login — development only, auto-login with ADMIN_EMAIL
router.post('/dev-login', (req: Request, res: Response) => {
  if (config.nodeEnv === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (repo.getConfig('dev_login_enabled') === '0') {
    res.status(403).json({ error: 'Dev login désactivé par l\'administrateur.' });
    return;
  }

  const adminEmail = config.adminEmail;
  if (!adminEmail) {
    res.status(400).json({ error: 'ADMIN_EMAIL not configured' });
    return;
  }

  let user = repo.findUserByEmail(adminEmail);
  if (!user) {
    user = repo.createUser(adminEmail);
    repo.setUserAdmin(user.id, true);
    user = repo.findUserById(user.id)!;
  }
  repo.updateUserLastLogin(user.id);

  const payload: JwtPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS512', expiresIn: `${getSessionDurationDays()}d` });

  setAuthCookie(res, token);
  repo.insertAuditLog(user.id, user.email, 'dev_login', 'user', user.id, 'Dev admin login', req.ip);
  res.json({ user: userResponse(user) });
});

// POST /api/auth/dev-login-client — development only, auto-login as regular user
router.post('/dev-login-client', (req: Request, res: Response) => {
  if (config.nodeEnv === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (repo.getConfig('dev_login_enabled') === '0') {
    res.status(403).json({ error: 'Dev login désactivé par l\'administrateur.' });
    return;
  }

  const clientEmail = 'client-demo@crabcreate.dev';
  let user = repo.findUserByEmail(clientEmail);
  if (!user) {
    user = repo.createUser(clientEmail);
    user = repo.findUserById(user.id)!;
  }
  repo.updateUserLastLogin(user.id);

  const payload: JwtPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS512', expiresIn: `${getSessionDurationDays()}d` });

  setAuthCookie(res, token);
  repo.insertAuditLog(user.id, user.email, 'dev_login', 'user', user.id, 'Dev client login', req.ip);
  res.json({ user: userResponse(user) });
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('crab_token', { path: '/' });
  res.json({ message: 'Déconnecté' });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const token = req.cookies?.crab_token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS512'] }) as JwtPayload;
    const user = repo.findUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json({ user: userResponse(user) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// PUT /api/auth/preferences (protected)
router.put('/preferences', requireAuth, (req: Request, res: Response) => {
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
