import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import * as repo from '../db/repositories';

import type { ProjectRole } from '../types';

export interface JwtPayload {
  userId: number;
  email: string;
}

export interface ProjectContext {
  id: number;
  name: string;
  slug: string;
  ownerId: number;
  isPrivate: boolean;
  userRole: ProjectRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      project?: ProjectContext;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Must be called after requireAuth
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = repo.findUserById(req.user.userId);
  if (!user || user.is_admin !== 1) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.crab_token;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS512'] }) as JwtPayload & { iat?: number };

    // Verify user still exists
    const user = repo.findUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check if user is blocked
    if (user.blocked === 1) {
      res.status(403).json({ error: 'Account blocked', reason: 'Votre compte a été suspendu. Contactez le support.' });
      return;
    }

    // Check if token was issued before logout (token revocation)
    const invalidatedAt = repo.getUserTokenInvalidatedAt(payload.userId);
    if (invalidatedAt && payload.iat) {
      const invalidatedTimestamp = Math.floor(new Date(invalidatedAt).getTime() / 1000);
      if (payload.iat <= invalidatedTimestamp) {
        res.status(401).json({ error: 'Token revoked' });
        return;
      }
    }

    // Use email from DB (not JWT) to avoid stale data after email changes
    req.user = { userId: payload.userId, email: user.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
