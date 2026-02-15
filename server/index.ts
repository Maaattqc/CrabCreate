import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import config from './config';
import { migrate } from './db/migrations';
import db from './db/sqlite';
import { initSocket } from './socket';
import { startQueue, stopQueue } from './services/queue';
import logger from './services/logger';
import * as repo from './db/repositories';

import authRouter from './routes/auth';
import contactRouter from './routes/contact';
import feedbackRouter from './routes/feedback';
import webhooksRouter from './routes/webhooks';
import ticketsRouter from './routes/tickets';
import pipelineRouter from './routes/pipeline';
import chatRouter from './routes/chat';
import promptsRouter from './routes/prompts';
import analyticsRouter from './routes/analytics';
import settingsRouter from './routes/settings';
import adminRouter from './routes/admin';
import billingRouter from './routes/billing';
import projectsRouter from './routes/projects';
import invitationsRouter from './routes/invitations';
import commentsRouter from './routes/comments';
import notificationsRouter from './routes/notifications';
import subtasksRouter from './routes/subtasks';
import labelsRouter from './routes/labels';
import favoritesRouter from './routes/favorites';
import templatesRouter from './routes/templates';
import userWebhooksRouter from './routes/user-webhooks';
import searchRouter from './routes/search';
import exportRouter from './routes/export';
import projectSetupRouter from './routes/project-setup';
import { stripeWebhookHandler, stripeWebhookLimiter } from './routes/stripe-webhook';
import { apiLimiter } from './middleware/rate-limit';
import { requireAuth } from './middleware/auth';
import { requireProject } from './middleware/project';
import { maintenanceGuard } from './middleware/maintenance';
import { csrfGuard } from './middleware/csrf';
import { isAllowedProjectRepoId } from './security/project-repo';

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function buildAllowedCorsOrigins(): Set<string> {
  const origins = new Set<string>();
  try {
    const base = new URL(config.clientUrl);
    origins.add(base.origin);

    if (isLoopbackHostname(base.hostname)) {
      const port = base.port ? `:${base.port}` : '';
      origins.add(`${base.protocol}//localhost${port}`);
      origins.add(`${base.protocol}//127.0.0.1${port}`);
      origins.add(`${base.protocol}//[::1]${port}`);
    }
  } catch {
    logger.error('[Security] Invalid CLIENT_URL configuration for CORS checks.');
  }

  const extraOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  for (const origin of extraOrigins) {
    origins.add(origin);
  }

  return origins;
}

function buildConnectSrc(): string[] {
  const values = ["'self'"];
  try {
    const host = new URL(config.clientUrl).host;
    values.push(`ws://${host}`, `wss://${host}`);
  } catch {
    logger.error('[Security] Invalid CLIENT_URL configuration for CSP connect-src checks.');
  }
  return values;
}

// Validate JWT secret in production
if (config.nodeEnv === 'production' && (!config.jwtSecret || config.jwtSecret === 'dev-secret-change-me-in-production' || config.jwtSecret.length < 64)) {
  logger.error('JWT_SECRET must be set to a strong secret (64+ chars) in production. Exiting.');
  process.exit(1);
}

// Validate encryption key separation in production
if (config.nodeEnv === 'production' && !process.env.SECRETS_ENCRYPTION_KEY) {
  logger.error('SECRETS_ENCRYPTION_KEY must be set in production (separate from JWT_SECRET). Exiting.');
  process.exit(1);
}

// Validate Stripe configuration: both keys must be set together
if (config.stripeSecretKey && !config.stripeWebhookSecret) {
  logger.warn('STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing. Stripe webhooks will not work.');
}
if (!config.stripeSecretKey && config.stripeWebhookSecret) {
  logger.warn('STRIPE_WEBHOOK_SECRET is set but STRIPE_SECRET_KEY is missing. Billing will not work.');
}

// Run migrations
migrate();

const app = express();

// Trust proxy setting is environment-driven; default is 0 outside production.
app.set('trust proxy', config.trustProxy);
if (config.nodeEnv !== 'production' && config.trustProxy !== 0 && config.trustProxy !== false) {
  logger.warn('[Security] TRUST_PROXY is enabled outside production. Keep this disabled for local-only development.');
}

const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// Security headers via helmet
// NOTE: styleSrc 'unsafe-inline' is required by Tailwind CSS 4 runtime styles.
// This is acceptable since scriptSrc does NOT allow unsafe-inline.
const cspDirectives: Record<string, string[]> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: buildConnectSrc(),
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  manifestSrc: ["'self'"],
};

if (config.nodeEnv === 'production') {
  cspDirectives.upgradeInsecureRequests = [];
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: cspDirectives,
  },
  hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Permissions-Policy header — restrict browser features
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  next();
});

// Request correlation id for incident investigations
app.use((req: Request, res: Response, next: NextFunction) => {
  const headerRequestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].trim() : '';
  const requestId = headerRequestId || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  next();
});

// Middleware
const allowedCorsOrigins = buildAllowedCorsOrigins();
app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedCorsOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    logger.security('cors_blocked', { origin });
    callback(null, false);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
}));

// Block direct probes to .env files. For browser navigation, redirect to dashboard.
const SENSITIVE_ENV_PATH_RE = /(^|\/)\.env(?:\.[^/]+)?(?:\/)?$/i;
app.use((req: Request, res: Response, next: NextFunction) => {
  let requestPath = req.path;
  try {
    requestPath = decodeURIComponent(req.path);
  } catch {
    // Keep raw path if decoding fails
  }

  if (!SENSITIVE_ENV_PATH_RE.test(requestPath)) {
    next();
    return;
  }

  logger.security('sensitive_path_probe_blocked', {
    method: req.method,
    path: requestPath,
    origin: req.headers.origin || null,
    referer: req.headers.referer || null,
    ip: req.ip,
  });

  const accept = req.headers.accept || '';
  if (req.method === 'GET' && typeof accept === 'string' && accept.includes('text/html')) {
    res.redirect(302, '/dashboard');
    return;
  }

  res.status(404).json({ error: 'Not found' });
});

// Stripe webhook — must be before express.json() for raw body signature verification
app.post('/api/webhooks/stripe', stripeWebhookLimiter, express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({
  limit: '256kb',
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
}));
app.use(cookieParser());

// Rate limiting
app.use('/api', apiLimiter);
app.use('/api', csrfGuard);

// Health check (no auth, no rate limit)
app.get('/health', (_req: Request, res: Response) => {
  try {
    // Quick DB check
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// Public routes (before requireAuth)
app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/webhooks', webhooksRouter);

// Public plans config for pricing page
const PLAN_KEYS = [
  'plan_free_tickets', 'plan_free_pipelines',
  'plan_pro_tickets', 'plan_pro_pipelines',
  'plan_enterprise_tickets', 'plan_enterprise_pipelines',
] as const;
const PLAN_DEFAULTS: Record<string, number> = {
  plan_free_tickets: 5, plan_free_pipelines: 1,
  plan_pro_tickets: 50, plan_pro_pipelines: 3,
  plan_enterprise_tickets: -1, plan_enterprise_pipelines: 10,
};
app.get('/api/plans', (_req: Request, res: Response) => {
  const result: Record<string, number> = {};
  for (const key of PLAN_KEYS) {
    const val = repo.getConfig(key);
    result[key] = val !== undefined ? parseInt(val, 10) : PLAN_DEFAULTS[key];
  }
  res.json(result);
});

// Protected API gate
app.use('/api', requireAuth);

// App config — UI settings for authenticated users (before maintenance guard)
const UI_CONFIG_KEYS = [
  'notification_timeout_ms', 'score_threshold_good', 'score_threshold_ok',
] as const;
const UI_CONFIG_DEFAULTS: Record<string, number> = {
  notification_timeout_ms: 5000, score_threshold_good: 70, score_threshold_ok: 50,
};
app.get('/api/app-config', (_req: Request, res: Response) => {
  const result: Record<string, number> = {};
  for (const key of UI_CONFIG_KEYS) {
    const val = repo.getConfig(key);
    result[key] = val !== undefined ? parseInt(val, 10) : UI_CONFIG_DEFAULTS[key];
  }
  res.json(result);
});

// Maintenance mode — blocks non-admin users
app.use('/api', maintenanceGuard);

// API Routes (all protected)
app.use('/api/projects', projectsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/tickets', requireProject, ticketsRouter);
app.use('/api/pipeline', requireProject, pipelineRouter);
app.use('/api/chat', requireProject, chatRouter);
app.use('/api/comments', requireProject, commentsRouter);
app.use('/api/tickets', requireProject, subtasksRouter);
app.use('/api/labels', requireProject, labelsRouter);
app.use('/api/favorites', requireProject, favoritesRouter);
app.use('/api/templates', requireProject, templatesRouter);
app.use('/api/user-webhooks', requireProject, userWebhooksRouter);
app.use('/api/search', requireProject, searchRouter);
app.use('/api/export', requireProject, exportRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', requireProject, analyticsRouter);
app.use('/api/project-setup', requireProject, projectSetupRouter);
app.use('/api/prompts', promptsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/billing', billingRouter);

// File locks endpoint (project-scoped)
app.get('/api/file-locks', requireProject, (req: Request, res: Response) => {
  const locks = repo.findFileLocksForProject(req.project!.id);
  res.json(locks);
});

app.get('/api/repos', requireProject, (req: Request, res: Response) => {
  const project = repo.findProjectById(req.project!.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (!project.default_repo || !isAllowedProjectRepoId(req.project!.id, String(project.default_repo))) {
    logger.warn(`[Security] Project ${req.project!.id} has unauthorized default_repo: ${String(project.default_repo)}`);
    res.json([]);
    return;
  }

  const projectRepo = project.default_repo ? repo.findRepoById(project.default_repo) : undefined;
  const repos = projectRepo ? [projectRepo] : [];

  // Strip sensitive fields — never expose tokens or credentialed clone URLs to the client
  const safe = repos.map(({ provider_token, clone_url, ...rest }) => rest);
  res.json(safe);
});

// Serve React build in production
if (config.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start queue polling
startQueue();

server.listen(config.port, config.host, () => {
  logger.info(`CrabCreate running on http://${config.host}:${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');

    // Stop queue polling
    stopQueue();
    logger.info('Queue stopped');

    // Close SQLite connection
    try {
      db.close();
      logger.info('Database closed');
    } catch {
      // already closed
    }

    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
