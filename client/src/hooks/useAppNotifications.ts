import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/notifications';
import type { AppNotification } from '../types';

export function useAppNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.fetchNotifications();
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => { refresh(); }, [refresh]);

  // Poll every 30s for new notifications
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    await api.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    setUnread(0);
  }, []);

  const remove = useCallback(async (id: number) => {
    const notif = notifications.find(n => n.id === id);
    await api.deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notif && notif.read === 0) setUnread(prev => Math.max(0, prev - 1));
  }, [notifications]);

  return { notifications, unread, loading, refresh, markRead, markAllRead, remove };
}
