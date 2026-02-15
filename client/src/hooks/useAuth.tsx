import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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
  activateSession: (user: AuthUser) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  requestCode: async () => ({ message: '' }),
  verifyCode: async () => ({ id: 0, email: '', isAdmin: false, isVisitor: false, plan: 'free', stripeSubscriptionStatus: null, preferences: {} }),
  activateSession: () => {},
  updatePreferences: async () => {},
  logout: async () => {},
});

const API = '/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionActivatedRef = useRef(false);

  useEffect(() => {
    fetch(`${API}/me`, { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        if (!sessionActivatedRef.current) setUser(data.user);
      })
      .catch(() => {
        if (!sessionActivatedRef.current) setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const requestCode = useCallback(async (email: string) => {
    const res = await fetch(`${API}/request-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<AuthUser> => {
    const res = await fetch(`${API}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    return data.user;
  }, []);

  const activateSession = useCallback((u: AuthUser) => {
    sessionActivatedRef.current = true;
    setUser(u);
    setLoading(false);
  }, []);

  const updatePreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    const res = await fetch(`${API}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(prefs),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setUser(prev => prev ? { ...prev, preferences: data.preferences } : null);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    localStorage.removeItem('crab-current-project');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, requestCode, verifyCode, activateSession, updatePreferences, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
