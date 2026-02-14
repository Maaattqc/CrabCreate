import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock socket.io-client so useSocket does not try to connect
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Helper: render App at a given route path
function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    // Default: /me returns unauthenticated
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/api/auth/me')) {
        return {
          ok: false,
          json: async () => ({ error: 'Not authenticated' }),
        } as Response;
      }
      // For any other fetch (e.g., /api/tickets), return empty
      return {
        ok: true,
        json: async () => ([]),
      } as Response;
    });
  });

  it('/ renders LandingPage with hero text', async () => {
    renderAtRoute('/');

    await waitFor(() => {
      // French is the default language; hero text appears in both the hero and bottom CTA sections
      const matches = screen.getAllByText(/Automatisez vos modifications de code avec l'IA/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('/pricing renders PricingPage', async () => {
    renderAtRoute('/pricing');

    await waitFor(() => {
      expect(screen.getByText(/Tarifs simples et transparents/)).toBeInTheDocument();
    });
  });

  it('/login redirects to /dashboard and shows login overlay', async () => {
    renderAtRoute('/login');

    await waitFor(() => {
      // /login redirects to /dashboard which shows the dashboard with login modal overlay
      // "CrabCreate" appears in both the header and the login modal
      const matches = screen.getAllByText('CrabCreate');
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Connectez-vous pour accéder au dashboard/)).toBeInTheDocument();
    });
  });

  it('/dashboard shows login overlay when not authenticated', async () => {
    renderAtRoute('/dashboard');

    await waitFor(() => {
      // DashboardWithAuth shows dashboard + login modal overlay for unauthenticated users
      const matches = screen.getAllByText('CrabCreate');
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Connectez-vous pour accéder au dashboard/)).toBeInTheDocument();
    });
  });

  it('/nonexistent renders NotFoundPage', async () => {
    renderAtRoute('/nonexistent');

    await waitFor(() => {
      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText(/Page introuvable/)).toBeInTheDocument();
    });
  });
});
