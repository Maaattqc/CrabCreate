import { createContext, useContext, useState, useCallback } from 'react';

interface LoginModalContextType {
  showLogin: boolean;
  openLogin: () => void;
  closeLogin: () => void;
}

const LoginModalContext = createContext<LoginModalContextType>({
  showLogin: false,
  openLogin: () => {},
  closeLogin: () => {},
});

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [showLogin, setShowLogin] = useState(false);
  const openLogin = useCallback(() => setShowLogin(true), []);
  const closeLogin = useCallback(() => setShowLogin(false), []);

  return (
    <LoginModalContext.Provider value={{ showLogin, openLogin, closeLogin }}>
      {children}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  return useContext(LoginModalContext);
}
