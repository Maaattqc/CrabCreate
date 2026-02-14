import { Request, Response, NextFunction } from 'express';
import db from '../db/sqlite';
import * as repo from '../db/repositories';

const ACTIVE_STATUSES = ['estimating', 'ai_coding', 'ai_review', 'testing', 'deploying'];

export function pipelineGuard(req: Request, res: Response, next: NextFunction): void {
  const maxConcurrent = parseInt(repo.getConfig('max_concurrent_pipelines') || '2', 10);

  // Count active pipelines
  const placeholders = ACTIVE_STATUSES.map(() => '?').join(',');
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM kanban_tickets WHERE status IN (${placeholders})`
  ).get(...ACTIVE_STATUSES) as { count: number };

  if (row.count >= maxConcurrent) {
    res.status(429).json({
      error: `Maximum ${maxConcurrent} pipelines simultanés atteint. Réessayez plus tard.`,
    });
    return;
  }
  next();
}
