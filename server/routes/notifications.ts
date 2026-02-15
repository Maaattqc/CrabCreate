import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/notifications -- List notifications for current user
router.get('/', (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const notifications = repo.findNotificationsByUserId(userId);

  // Filter out notifications from projects the user is no longer a member of
  const userProjects = repo.findProjectsByUserId(userId);
  const projectIds = new Set(userProjects.map(p => p.id));
  // Also allow global admin to see all notifications
  const user = repo.findUserById(userId);
  const isAdmin = user?.is_admin === 1;

  const filtered = notifications.filter(n =>
    !n.project_id || isAdmin || projectIds.has(n.project_id)
  );
  const unread = filtered.filter(n => n.read === 0).length;

  res.json({ notifications: filtered, unread });
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
