import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/search?q=...
router.get('/', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim().slice(0, 500);
  if (!query || query.length < 2) {
    return res.json([]);
  }
  const results = repo.globalSearch(req.project!.id, query);
  res.json(results);
});

export default router;
