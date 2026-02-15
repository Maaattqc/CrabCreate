import type { AppNotification } from '../types';
import { apiJson, apiVoid } from './http';

export async function fetchNotifications(): Promise<{ notifications: AppNotification[]; unread: number }> {
  return apiJson<{ notifications: AppNotification[]; unread: number }>('/api/notifications', {
    defaultErrorMessage: 'Failed to load notifications',
  });
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiVoid(`/api/notifications/${id}/read`, {
    method: 'POST',
    defaultErrorMessage: 'Failed to mark notification as read',
  });
}

export async function markAllRead(): Promise<void> {
  await apiVoid('/api/notifications/read-all', {
    method: 'POST',
    defaultErrorMessage: 'Failed to mark notifications as read',
  });
}

export async function deleteNotification(id: number): Promise<void> {
  await apiVoid(`/api/notifications/${id}`, {
    method: 'DELETE',
    defaultErrorMessage: 'Failed to delete notification',
  });
}
