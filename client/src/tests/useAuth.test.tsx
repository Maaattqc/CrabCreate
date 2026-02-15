import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';
import type { AuthUser } from '../hooks/useAuth';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const mockUser: AuthUser = {
  id: 1,
  email: 'test@example.com',
  isAdmin: false,
  isVisitor: false,
  plan: 'free',
  stripeSubscriptionStatus: null,
  preferences: { lang: 'fr', theme: 'dark' },
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initial state: user null, loading true', () => {
    // Mock fetch to hang so loading stays true
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('after /me returns user: user is set, loading false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser }),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('after /me fails: user null, loading false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authenticated' }),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('requestCode: calls fetch with correct params', async () => {
    // First call is /me, second is requestCode
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Code sent' }),
      } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response: { message: string } | undefined;
    await act(async () => {
      response = await result.current.requestCode('test@example.com');
    });

    expect(response).toEqual({ message: 'Code sent' });

    // Check the second fetch call (requestCode)
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'test@example.com' }),
    });
  });

  it('verifyCode: calls fetch, returns user', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not authenticated' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let user: AuthUser | undefined;
    await act(async () => {
      user = await result.current.verifyCode('test@example.com', '12345678');
    });

    expect(user).toEqual(mockUser);

    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'test@example.com', code: '12345678' }),
    });
  });

  it('activateSession: sets user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authenticated' }),
    } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();

    act(() => {
      result.current.activateSession(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('logout: clears user', async () => {
    // First /me returns a user, then logout call
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });

  it('updatePreferences: updates user preferences', async () => {
    const updatedPrefs = { lang: 'en' as const, theme: 'light' as const };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ preferences: updatedPrefs }),
      } as Response);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.updatePreferences({ lang: 'en', theme: 'light' });
    });

    expect(result.current.user?.preferences).toEqual(updatedPrefs);
  });
});
