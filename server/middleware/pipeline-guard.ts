import { Request, Response, NextFunction } from 'express';
import * as repo from '../db/repositories';

export function pipelineGuard(req: Request, res: Response, next: NextFunction): void {
  const maxConcurrent = parseInt(repo.getConfig('max_concurrent_pipelines') || '2', 10);

  const count = repo.countActivePipelines(req.project?.id);

  if (count >= maxConcurrent) {
    res.status(429).json({
      error: `Maximum ${maxConcurrent} pipelines simultanés atteint. Réessayez plus tard.`,
    });
    return;
  }
  next();
}
