import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchComments,
  createComment,
  deleteComment,
  toggleReaction,
  toggleWatch,
} from '../api/comments';
import {
  fetchNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} from '../api/notifications';

describe('Comments API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchComments calls correct URL with ticketId', async () => {
    const mockComments = [
      { id: 1, ticket_id: 123, user_id: 1, content: 'Test comment', created_at: '2026-01-01' },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockComments,
    } as Response);

    const result = await fetchComments(123);

    expect(fetchSpy).toHaveBeenCalledWith('/api/comments/123', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual(mockComments);
  });

  it('createComment sends POST with content', async () => {
    const mockComment = {
      id: 1,
      ticket_id: 123,
      user_id: 1,
      content: 'New comment',
      created_at: '2026-01-01',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockComment,
    } as Response);

    const result = await createComment(123, 'New comment');

    expect(fetchSpy).toHaveBeenCalledWith('/api/comments/123', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'New comment' }),
    });
    expect(result).toEqual(mockComment);
  });

  it('deleteComment sends DELETE with correct URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    await deleteComment(123, 456);

    expect(fetchSpy).toHaveBeenCalledWith('/api/comments/123/456', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('toggleReaction sends POST with emoji', async () => {
    const mockResponse = {
      added: true,
      reactions: [{ emoji: '👍', user_id: 1 }],
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await toggleReaction(123, 456, '👍');

    expect(fetchSpy).toHaveBeenCalledWith('/api/comments/123/456/react', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍' }),
    });
    expect(result).toEqual(mockResponse);
  });

  it('toggleWatch sends POST to correct URL', async () => {
    const mockResponse = { watching: true };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await toggleWatch(123);

    expect(fetchSpy).toHaveBeenCalledWith('/api/comments/123/watch', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result).toEqual(mockResponse);
  });

  it('fetchComments throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchComments(123)).rejects.toThrow('Failed to load comments');
  });

  it('createComment throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
    } as Response);

    await expect(createComment(123, 'Test')).rejects.toThrow('Failed to create comment');
  });
});

describe('Notifications API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchNotifications calls correct URL', async () => {
    const mockData = {
      notifications: [
        { id: 1, user_id: 1, type: 'comment', message: 'New comment', read: false, created_at: '2026-01-01' },
      ],
      unread: 1,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await fetchNotifications();

    expect(fetchSpy).toHaveBeenCalledWith('/api/notifications', { credentials: 'include' });
    expect(result).toEqual(mockData);
  });

  it('markNotificationRead sends POST with correct ID', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    await markNotificationRead(42);

    expect(fetchSpy).toHaveBeenCalledWith('/api/notifications/42/read', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('markAllRead sends POST to read-all', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    await markAllRead();

    expect(fetchSpy).toHaveBeenCalledWith('/api/notifications/read-all', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('deleteNotification sends DELETE with correct ID', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    await deleteNotification(99);

    expect(fetchSpy).toHaveBeenCalledWith('/api/notifications/99', {
      method: 'DELETE',
      credentials: 'include',
    });
  });

  it('fetchNotifications throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchNotifications()).rejects.toThrow('Failed to load notifications');
  });
});
