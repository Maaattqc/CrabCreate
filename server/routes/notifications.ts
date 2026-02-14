import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/notifications -- List notifications for current user
router.get('/', (req: Request, res: Response) => {
  const notifications = repo.findNotificationsByUserId(req.user!.userId);
  const unread = repo.countUnreadNotifications(req.user!.userId);
  res.json({ notifications, unread });
});

// POST /api/notifications/:id/read -- Mark one notification as read
router.post('/:id/read', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  repo.markNotificationRead(id, req.user!.userId);
  res.json({ success: true });
});

// POST /api/notifications/read-all -- Mark all as read
router.post('/read-all', (req: Request, res: Response) => {
  repo.markAllNotificationsRead(req.user!.userId);
  res.json({ success: true });
});

// DELETE /api/notifications/:id -- Delete a notification
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  repo.deleteNotification(id, req.user!.userId);
  res.json({ success: true });
});

export default router;
