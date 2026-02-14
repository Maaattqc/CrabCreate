import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface AnimationsContextType {
  animations: boolean;
  setAnimations: (v: boolean) => void;
}

const AnimationsContext = createContext<AnimationsContextType>({
  animations: true,
  setAnimations: () => {},
});

export function AnimationsProvider({ children }: { children: React.ReactNode }) {
  const [animations, setAnimState] = useState<boolean>(() => {
    const saved = localStorage.getItem('crab-animations');
    return saved === null ? true : saved === 'true';
  });

  const setAnimations = useCallback((v: boolean) => {
    setAnimState(v);
    localStorage.setItem('crab-animations', String(v));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-animations', animations ? 'on' : 'off');
  }, [animations]);

  return (
    <AnimationsContext.Provider value={{ animations, setAnimations }}>
      {children}
    </AnimationsContext.Provider>
  );
}

export function useAnimations() {
  return useContext(AnimationsContext);
}
