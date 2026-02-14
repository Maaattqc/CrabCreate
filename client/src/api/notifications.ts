import type { AppNotification } from '../types';

export async function fetchNotifications(): Promise<{ notifications: AppNotification[]; unread: number }> {
  const res = await fetch('/api/notifications', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load notifications');
  return res.json();
}

export async function markNotificationRead(id: number): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' });
}

export async function markAllRead(): Promise<void> {
  await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
}

export async function deleteNotification(id: number): Promise<void> {
  await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' });
}
