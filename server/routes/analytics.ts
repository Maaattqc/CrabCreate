import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/analytics — scoped to current project
router.get('/', (req: Request, res: Response) => {
  const projectId = req.project!.id;
  const analytics = repo.getAnalyticsForProject(projectId);
  res.json(analytics);
});

export default router;
