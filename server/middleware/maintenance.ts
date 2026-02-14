import { Request, Response, NextFunction } from 'express';
import * as repo from '../db/repositories';

/**
 * Blocks non-admin requests when maintenance_mode is enabled.
 * Must be placed after requireAuth so req.user is available.
 */
export function maintenanceGuard(req: Request, res: Response, next: NextFunction): void {
  const val = repo.getConfig('maintenance_mode');
  if (val === '1') {
    // Allow admins through
    if (req.user) {
      const user = repo.findUserById(req.user.userId);
      if (user && user.is_admin === 1) {
        next();
        return;
      }
    }
    res.status(503).json({ error: 'Maintenance en cours. Réessayez plus tard.' });
    return;
  }
  next();
}
