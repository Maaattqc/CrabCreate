import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';

// Default settings
const DEFAULTS = {
  max_requests_per_minute: 200,
  max_tickets_per_hour: 20,
  max_concurrent_pipelines: 2,
};

function getSetting(key: string, fallback: number): number {
  const val = repo.getConfig(key);
  return val ? parseInt(val, 10) : fallback;
}

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: () => getSetting('max_requests_per_minute', DEFAULTS.max_requests_per_minute),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Ticket creation rate limiter
export const createTicketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: () => getSetting('max_tickets_per_hour', DEFAULTS.max_tickets_per_hour),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many tickets created, please wait' },
});
