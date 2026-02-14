import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mock translations ────────────────────────────────────────────────────

const mockTranslations = {
  tabComments: 'Comments',
  commentsEmpty: 'No comments yet.',
  commentsPlaceholder: 'Write a comment...',
  commentsSend: 'Send',
  commentsEdit: 'Edit',
  commentsDelete: 'Delete',
  commentsEdited: '(edited)',
  commentsMentionHint: 'Use @email to mention someone',
  commentsTyping: 'is typing...',
  commentsEditingLock: 'Someone is editing this comment',
  watchTicket: 'Watch ticket',
  unwatchTicket: 'Unwatch ticket',
  watchersCount: 'watchers',
  notificationsTitle: 'Notifications',
  notificationsEmpty: 'No notifications.',
  notificationsMarkAllRead: 'Mark all as read',
  notificationsMention: 'Mentioned you',
  notificationsComment: 'Commented',
  notificationsStatusChange: 'Status changed',
  userStatusAvailable: 'Available',
  userStatusBusy: 'Busy',
  userStatusAway: 'Away',
  viewingTicket: 'viewing',
  draggingTicket: 'dragging',
  reactionsAdd: 'Add reaction',
  loading: 'Loading...',
  save: 'Save',
  cancel: 'Cancel',
};

// ── Mock hooks ───────────────────────────────────────────────────────────

vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({ t: mockTranslations, lang: 'en', setLang: vi.fn() }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, email: 'test@example.com' }, loading: false }),
}));

vi.mock('../hooks/useProject', () => ({
  useProject: () => ({ currentProject: { id: 1, name: 'Test' }, loading: false }),
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: true }),
}));

vi.mock('../hooks/useCollaboration', () => ({
  useTypingIndicator: () => ({
    typingUsers: [],
    sendTyping: vi.fn(),
    sendStopTyping: vi.fn(),
  }),
}));

// ── Mock API ─────────────────────────────────────────────────────────────

vi.mock('../api/comments', () => ({
  fetchComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  toggleReaction: vi.fn(),
}));

// ── Mock useAppNotifications ─────────────────────────────────────────────

vi.mock('../hooks/useAppNotifications', () => ({
  useAppNotifications: () => ({
    notifications: [],
    unread: 0,
    loading: false,
    refresh: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    remove: vi.fn(),
  }),
}));

// ── Import components ────────────────────────────────────────────────────

import CommentsTab from '../components/detail-tabs/CommentsTab';
import NotificationBell from '../components/layout/NotificationBell';
import * as commentsApi from '../api/comments';

// ═══════════════════════════════════════════════════════════════════════════
// CommentsTab
// ═══════════════════════════════════════════════════════════════════════════

describe('CommentsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(commentsApi.fetchComments).mockResolvedValue([]);
  });

  it('renders empty state with "No comments yet" text', async () => {
    vi.mocked(commentsApi.fetchComments).mockResolvedValue([]);
    render(<CommentsTab ticketId={1} />);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for loading to finish and empty state to appear
    const emptyMessage = await screen.findByText('No comments yet.');
    expect(emptyMessage).toBeInTheDocument();
  });

  it('renders comment input placeholder text', async () => {
    vi.mocked(commentsApi.fetchComments).mockResolvedValue([]);
    render(<CommentsTab ticketId={1} />);

    // Wait for loading to finish
    await screen.findByText('No comments yet.');

    // Check placeholder
    const textarea = screen.getByPlaceholderText('Write a comment...');
    expect(textarea).toBeInTheDocument();
  });

  it('renders mention hint text', async () => {
    vi.mocked(commentsApi.fetchComments).mockResolvedValue([]);
    render(<CommentsTab ticketId={1} />);

    await screen.findByText('No comments yet.');

    expect(screen.getByText('Use @email to mention someone')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NotificationBell
// ═══════════════════════════════════════════════════════════════════════════

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bell icon', () => {
    render(<NotificationBell />);

    // The bell button should be in the document
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('does not show unread badge when count is 0', () => {
    render(<NotificationBell />);

    // The badge should not be visible when unread is 0
    const badge = document.querySelector('.bg-red-500');
    expect(badge).not.toBeInTheDocument();
  });

  it('handles onTicketClick callback', () => {
    const onTicketClick = vi.fn();
    render(<NotificationBell onTicketClick={onTicketClick} />);

    // Should render without errors even with callback
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
