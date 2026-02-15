import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

const tProxy = new Proxy(
  {},
  {
    get: (_target, prop) => String(prop),
  },
) as Record<string, string>;

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: tProxy,
    lang: 'fr',
    setLang: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AdminPage from '../components/admin/AdminPage';

function jsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    json: async () => payload,
  } as Response;
}

function createAdminFetchMock(fixtures?: {
  users?: any[];
  contacts?: any[];
  stats?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  logs?: { logs: any[]; total: number };
}) {
  const users = fixtures?.users ?? [];
  const contacts = fixtures?.contacts ?? [];
  const stats = fixtures?.stats ?? {
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    planCounts: {},
    totalTickets: 0,
    totalCost: 0,
    totalTokens: 0,
  };
  const settings = fixtures?.settings ?? { max_requests_per_minute: 60 };
  const logs = fixtures?.logs ?? { logs: [], total: 0 };

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/api/admin/users/') && url.includes('/block') && init?.method === 'PUT') {
      return jsonResponse({ success: true });
    }

    if (url.includes('/api/admin/users')) {
      return jsonResponse(users);
    }

    if (url.includes('/api/admin/contacts')) {
      return jsonResponse(contacts);
    }

    if (url.includes('/api/admin/stats')) {
      return jsonResponse(stats);
    }

    if (url.includes('/api/settings')) {
      return jsonResponse(settings);
    }

    if (url.includes('/api/admin/logs')) {
      return jsonResponse(logs);
    }

    return jsonResponse({});
  });
}

function findFetchCall(fetchMock: ReturnType<typeof vi.fn>, urlPart: string) {
  return fetchMock.mock.calls.find(([input]) => String(input).includes(urlPart));
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 10, email: 'admin@example.com', isAdmin: true },
      loading: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects non-admin users to dashboard', async () => {
    const fetchMock = createAdminFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    mockUseAuth.mockReturnValue({
      user: { id: 10, email: 'member@example.com', isAdmin: false },
      loading: false,
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('loads admin data on mount and renders stats', async () => {
    const fetchMock = createAdminFetchMock({
      users: [
        {
          id: 10,
          email: 'admin@example.com',
          isAdmin: true,
          plan: 'pro',
          blocked: false,
          blockedReason: null,
          stripeSubscriptionStatus: 'active',
          createdAt: '2026-01-01',
          lastLoginAt: '2026-02-10',
        },
      ],
      stats: {
        totalUsers: 42,
        activeUsers: 30,
        blockedUsers: 2,
        planCounts: { free: 20, pro: 20, enterprise: 2 },
        totalTickets: 123,
        totalCost: 18.4,
        totalTokens: 9000,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('adminTitle')).toBeInTheDocument();
      expect(screen.getByText('adminTotalUsers')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    const usersCall = findFetchCall(fetchMock, '/api/admin/users');
    const contactsCall = findFetchCall(fetchMock, '/api/admin/contacts');
    const statsCall = findFetchCall(fetchMock, '/api/admin/stats');
    const settingsCall = findFetchCall(fetchMock, '/api/settings');
    const logsCall = findFetchCall(fetchMock, '/api/admin/logs?limit=50&offset=0');

    expect(usersCall?.[1]).toMatchObject({ credentials: 'include' });
    expect(contactsCall?.[1]).toMatchObject({ credentials: 'include' });
    expect(statsCall?.[1]).toMatchObject({ credentials: 'include' });
    expect(settingsCall?.[1]).toMatchObject({ credentials: 'include' });
    expect(logsCall?.[1]).toMatchObject({ credentials: 'include' });
  });

  it('opens block modal and submits block action', async () => {
    const fetchMock = createAdminFetchMock({
      users: [
        {
          id: 10,
          email: 'admin@example.com',
          isAdmin: true,
          plan: 'pro',
          blocked: false,
          blockedReason: null,
          stripeSubscriptionStatus: 'active',
          createdAt: '2026-01-01',
          lastLoginAt: '2026-02-10',
        },
        {
          id: 22,
          email: 'target@example.com',
          isAdmin: false,
          plan: 'free',
          blocked: false,
          blockedReason: null,
          stripeSubscriptionStatus: null,
          createdAt: '2026-01-02',
          lastLoginAt: null,
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminPage />);

    // Wait for initial loading to complete before clicking tab
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'adminUsers' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'adminUsers' }));

    await waitFor(() => {
      expect(screen.getByText('target@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'adminBlock' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Abuse, spam...'), {
      target: { value: 'Abuse' },
    });

    const blockButtons = screen.getAllByRole('button', { name: 'adminBlock' });
    fireEvent.click(blockButtons[blockButtons.length - 1]);

    await waitFor(() => {
      const blockCall = findFetchCall(fetchMock, '/api/admin/users/22/block');
      expect(blockCall).toBeDefined();
      expect(blockCall?.[1]).toMatchObject({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: true, reason: 'Abuse' }),
      });
    });
  });
});
