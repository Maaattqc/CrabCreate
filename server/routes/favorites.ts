import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/favorites
router.get('/', (req: Request, res: Response) => {
  const favorites = repo.findFavoritesByUserId(req.user!.userId);
  res.json(favorites);
});

// POST /api/favorites/:ticketId
router.post('/:ticketId', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const ticket = repo.findTicketById(ticketId);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  const result = repo.toggleFavorite(req.user!.userId, ticketId);
  res.json(result);
});

// GET /api/favorites/check/:ticketId
router.get('/check/:ticketId', (req: Request, res: Response) => {
  const ticketId = Number(req.params.ticketId);
  const favorited = repo.isFavorite(req.user!.userId, ticketId);
  res.json({ favorited });
});

export default router;
