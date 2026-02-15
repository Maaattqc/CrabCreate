import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { disconnectSocket, reconnectSocket } from './useSocket';
import { apiJson, apiVoid, AUTH_UNAUTHORIZED_EVENT } from '../api/http';

export interface UserPreferences {
  lang?: 'fr' | 'en';
  theme?: 'dark' | 'light';
  animations?: boolean;
  aiDesign?: boolean;
  mascot?: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  isAdmin: boolean;
  isVisitor: boolean;
  plan: string;
  stripeSubscriptionStatus: string | null;
  preferences: UserPreferences;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  requestCode: (email: string) => Promise<{ message: string }>;
  verifyCode: (email: string, code: string) => Promise<AuthUser>;
  refreshSession: () => Promise<AuthUser | null>;
  activateSession: (user: AuthUser) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  requestCode: async () => ({ message: '' }),
  verifyCode: async () => ({ id: 0, email: '', isAdmin: false, isVisitor: false, plan: 'free', stripeSubscriptionStatus: null, preferences: {} }),
  refreshSession: async () => null,
  activateSession: () => {},
  updatePreferences: async () => {},
  logout: async () => {},
});

const API = '/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionActivatedRef = useRef(false);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const data = await apiJson<{ user: AuthUser }>(`${API}/me`, { defaultErrorMessage: 'Not authenticated' });
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    apiJson<{ user: AuthUser }>(`${API}/me`, { defaultErrorMessage: 'Not authenticated' })
      .then(data => {
        if (!sessionActivatedRef.current) setUser(data.user);
      })
      .catch(() => {
        if (!sessionActivatedRef.current) setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      sessionActivatedRef.current = false;
      disconnectSocket();
      setUser(null);
      setLoading(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized as EventListener);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized as EventListener);
    };
  }, []);

  const requestCode = useCallback(async (email: string) => {
    return apiJson<{ message: string }>(`${API}/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: { email },
      defaultErrorMessage: 'Request failed',
    });
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<AuthUser> => {
    const data = await apiJson<{ user: AuthUser }>(`${API}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: { email, code },
      defaultErrorMessage: 'Verification failed',
    });
    return data.user;
  }, []);

  const activateSession = useCallback((u: AuthUser) => {
    sessionActivatedRef.current = true;
    setUser(u);
    setLoading(false);
    reconnectSocket();
  }, []);

  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    const data = await apiJson<{ preferences: UserPreferences }>(`${API}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      jsonBody: prefs,
      defaultErrorMessage: 'Update failed',
    });
    setUser(prev => prev ? { ...prev, preferences: data.preferences } : null);
  }, []);

  const logout = useCallback(async () => {
    disconnectSocket();
    await apiVoid(`${API}/logout`, {
      method: 'POST',
      defaultErrorMessage: 'Logout failed',
    });
    localStorage.removeItem('crab-current-project');
    sessionActivatedRef.current = false;
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, requestCode, verifyCode, refreshSession, activateSession, updatePreferences, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
