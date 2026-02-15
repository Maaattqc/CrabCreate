import type { Comment, WatcherInfo } from '../types';
import { apiJson, apiVoid } from './http';

export async function fetchComments(ticketId: number): Promise<Comment[]> {
  return apiJson<Comment[]>(`/api/comments/${ticketId}`, {
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    defaultErrorMessage: 'Failed to load comments',
  });
}

export async function createComment(ticketId: number, content: string): Promise<Comment> {
  return apiJson<Comment>(`/api/comments/${ticketId}`, {
    method: 'POST',
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    jsonBody: { content },
    defaultErrorMessage: 'Failed to create comment',
  });
}

export async function updateComment(ticketId: number, commentId: number, content: string): Promise<Comment> {
  return apiJson<Comment>(`/api/comments/${ticketId}/${commentId}`, {
    method: 'PUT',
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    jsonBody: { content },
    defaultErrorMessage: 'Failed to update comment',
  });
}

export async function deleteComment(ticketId: number, commentId: number): Promise<void> {
  return apiVoid(`/api/comments/${ticketId}/${commentId}`, {
    method: 'DELETE',
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    defaultErrorMessage: 'Failed to delete comment',
  });
}

export async function toggleReaction(ticketId: number, commentId: number, emoji: string): Promise<{ added: boolean; reactions: any[] }> {
  return apiJson<{ added: boolean; reactions: any[] }>(`/api/comments/${ticketId}/${commentId}/react`, {
    method: 'POST',
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    jsonBody: { emoji },
    defaultErrorMessage: 'Failed to toggle reaction',
  });
}

export async function fetchWatchers(ticketId: number): Promise<WatcherInfo> {
  return apiJson<WatcherInfo>(`/api/comments/${ticketId}/watchers`, {
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    defaultErrorMessage: 'Failed to load watchers',
  });
}

export async function toggleWatch(ticketId: number): Promise<{ watching: boolean }> {
  return apiJson<{ watching: boolean }>(`/api/comments/${ticketId}/watch`, {
    method: 'POST',
    includeProjectId: true,
    headers: { 'Content-Type': 'application/json' },
    defaultErrorMessage: 'Failed to toggle watch',
  });
}
