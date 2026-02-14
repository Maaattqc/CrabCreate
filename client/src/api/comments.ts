import type { Comment, WatcherInfo } from '../types';

/** Get the current project ID from localStorage */
function getProjectId(): string {
  return localStorage.getItem('crab-current-project') || '';
}

function projectHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const pid = getProjectId();
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  if (pid) base['X-Project-Id'] = pid;
  return { ...base, ...extra };
}

export async function fetchComments(ticketId: number): Promise<Comment[]> {
  const res = await fetch(`/api/comments/${ticketId}`, {
    credentials: 'include',
    headers: projectHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load comments');
  return res.json();
}

export async function createComment(ticketId: number, content: string): Promise<Comment> {
  const res = await fetch(`/api/comments/${ticketId}`, {
    method: 'POST',
    credentials: 'include',
    headers: projectHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to create comment');
  return res.json();
}

export async function updateComment(ticketId: number, commentId: number, content: string): Promise<Comment> {
  const res = await fetch(`/api/comments/${ticketId}/${commentId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: projectHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to update comment');
  return res.json();
}

export async function deleteComment(ticketId: number, commentId: number): Promise<void> {
  const res = await fetch(`/api/comments/${ticketId}/${commentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: projectHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete comment');
}

export async function toggleReaction(ticketId: number, commentId: number, emoji: string): Promise<{ added: boolean; reactions: any[] }> {
  const res = await fetch(`/api/comments/${ticketId}/${commentId}/react`, {
    method: 'POST',
    credentials: 'include',
    headers: projectHeaders(),
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error('Failed to toggle reaction');
  return res.json();
}

export async function fetchWatchers(ticketId: number): Promise<WatcherInfo> {
  const res = await fetch(`/api/comments/${ticketId}/watchers`, {
    credentials: 'include',
    headers: projectHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load watchers');
  return res.json();
}

export async function toggleWatch(ticketId: number): Promise<{ watching: boolean }> {
  const res = await fetch(`/api/comments/${ticketId}/watch`, {
    method: 'POST',
    credentials: 'include',
    headers: projectHeaders(),
  });
  if (!res.ok) throw new Error('Failed to toggle watch');
  return res.json();
}
