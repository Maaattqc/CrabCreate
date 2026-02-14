import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import config from './config';
import { migrate } from './db/migrations';
import db from './db/sqlite';
import { initSocket } from './socket';
import { startQueue, stopQueue } from './services/queue';
import logger from './services/logger';
import * as repo from './db/repositories';

import authRouter from './routes/auth';
import contactRouter from './routes/contact';
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
import { stripeWebhookHandler } from './routes/stripe-webhook';
import { apiLimiter } from './middleware/rate-limit';
import { requireAuth } from './middleware/auth';
import { requireProject } from './middleware/project';
import { maintenanceGuard } from './middleware/maintenance';

// Validate JWT secret in production
if (config.nodeEnv === 'production' && (!config.jwtSecret || config.jwtSecret === 'dev-secret-change-me-in-production' || config.jwtSecret.length < 32)) {
  logger.error('JWT_SECRET must be set to a strong secret (32+ chars) in production. Exiting.');
  process.exit(1);
}

// Run migrations
migrate();

const app = express();
const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Middleware
app.use(cors({ origin: config.clientUrl, credentials: true }));

// Stripe webhook — must be before express.json() for raw body signature verification
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Rate limiting
app.use('/api', apiLimiter);

// Health check (no auth, no rate limit)
app.get('/health', (_req: Request, res: Response) => {
  try {
    // Quick DB check
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// Public routes (before requireAuth)
app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
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
app.use('/api/favorites', favoritesRouter);
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

app.get('/api/repos', (req: Request, res: Response) => {
  const repos = repo.findAllRepos();
  res.json(repos);
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

server.listen(config.port, () => {
  logger.info(`CrabCreate running on http://localhost:${config.port}`);
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
