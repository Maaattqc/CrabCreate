import type { Ticket, TicketFilters, LogEntry, ChatMessage, ActivityItem, AnalyticsData, FileLock, ColumnTime } from '../types';
import { apiJson, getCurrentProjectId } from './http';

const API = '/api';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  return apiJson<T>(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    sessionErrorMessage: 'Session expired',
    defaultErrorMessage: 'Request failed',
  });
}

/** Adds X-Project-Id header for project-scoped requests */
function projectHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const pid = getCurrentProjectId() || '';
  return pid ? { 'X-Project-Id': pid, ...extra } : extra;
}

function projectRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(url, {
    ...options,
    headers: projectHeaders(options.headers),
  });
}

// Tickets CRUD (project-scoped)
export const getTickets = (filters: TicketFilters = {}): Promise<Ticket[]> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const qs = params.toString();
  return projectRequest<Ticket[]>(`${API}/tickets${qs ? '?' + qs : ''}`);
};

export const getTicket = (id: number): Promise<Ticket> => projectRequest<Ticket>(`${API}/tickets/${id}`);

export const createTicket = (data: Partial<Ticket>): Promise<Ticket> => projectRequest<Ticket>(`${API}/tickets`, {
  method: 'POST', body: JSON.stringify(data),
});

export const updateTicket = (id: number, data: Partial<Ticket>): Promise<Ticket> => projectRequest<Ticket>(`${API}/tickets/${id}`, {
  method: 'PUT', body: JSON.stringify(data),
});

export const deleteTicket = (id: number): Promise<void> => projectRequest<void>(`${API}/tickets/${id}`, {
  method: 'DELETE',
});

// Archive (project-scoped)
export const archiveTicket = (id: number): Promise<{ success: boolean }> => projectRequest<{ success: boolean }>(`${API}/tickets/${id}/archive`, { method: 'POST' });
export const unarchiveTicket = (id: number): Promise<{ success: boolean }> => projectRequest<{ success: boolean }>(`${API}/tickets/${id}/unarchive`, { method: 'POST' });

// Pipeline (project-scoped)
export const launchPipeline = (id: number): Promise<Ticket> => projectRequest<Ticket>(`${API}/pipeline/launch/${id}`, { method: 'POST' });
export const approveTicket = (id: number): Promise<Ticket> => projectRequest<Ticket>(`${API}/pipeline/approve/${id}`, { method: 'POST' });
export const rejectTicket = (id: number): Promise<Ticket> => projectRequest<Ticket>(`${API}/pipeline/reject/${id}`, { method: 'POST' });
export const retryTicket = (id: number): Promise<Ticket> => projectRequest<Ticket>(`${API}/pipeline/retry/${id}`, { method: 'POST' });
export const rollbackTicket = (id: number): Promise<Ticket> => projectRequest<Ticket>(`${API}/pipeline/rollback/${id}`, { method: 'POST' });

// Logs, chat, activity, diff (project-scoped)
export const getTicketLogs = (id: number): Promise<LogEntry[]> => projectRequest<LogEntry[]>(`${API}/tickets/${id}/logs`);
export const getTicketChat = (id: number): Promise<ChatMessage[]> => projectRequest<ChatMessage[]>(`${API}/chat/${id}`);
export const sendChatMessage = (id: number, message: string): Promise<ChatMessage> => projectRequest<ChatMessage>(`${API}/chat/${id}`, {
  method: 'POST', body: JSON.stringify({ message }),
});
export const getTicketActivity = (id: number): Promise<ActivityItem[]> => projectRequest<ActivityItem[]>(`${API}/tickets/${id}/activity`);
export const getTicketDiff = (id: number): Promise<string> => projectRequest<string>(`${API}/tickets/${id}/diff`);
export const getTicketColumnTimes = (id: number): Promise<ColumnTime[]> => projectRequest<ColumnTime[]>(`${API}/tickets/${id}/column-times`);

// Analytics (project-scoped)
export const getAnalytics = (): Promise<AnalyticsData> => projectRequest<AnalyticsData>(`${API}/analytics`);

// Prompts (not project-scoped)
export const getPrompts = (): Promise<{ systemPrompt: string }> => request<{ systemPrompt: string }>(`${API}/prompts`);
export const updatePrompts = (systemPrompt: string): Promise<{ systemPrompt: string }> => request<{ systemPrompt: string }>(`${API}/prompts`, {
  method: 'PUT', body: JSON.stringify({ systemPrompt }),
});

// Settings (not project-scoped)
export const getSettings = (): Promise<Record<string, number>> => request<Record<string, number>>(`${API}/settings`);
export const updateSettings = (data: Record<string, number>): Promise<Record<string, number>> => request<Record<string, number>>(`${API}/settings`, {
  method: 'PUT', body: JSON.stringify(data),
});

// Reorder backlog tickets (project-scoped)
export const reorderTickets = (ticketIds: number[]): Promise<{ success: boolean }> =>
  projectRequest<{ success: boolean }>(`${API}/tickets/reorder`, {
    method: 'POST', body: JSON.stringify({ ticketIds }),
  });

// Feedback (public, no auth required)
export const submitFeedback = (rating: number): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>(`${API}/feedback`, {
    method: 'POST', body: JSON.stringify({ rating }),
  });

// File locks (project-scoped) & repos
export const getFileLocks = (): Promise<FileLock[]> => projectRequest<FileLock[]>(`${API}/file-locks`);
export const getRepos = (): Promise<string[]> => projectRequest<string[]>(`${API}/repos`);
