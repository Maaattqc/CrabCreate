import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface AIDesignContextType {
  aiDesign: boolean;
  setAIDesign: (v: boolean) => void;
}

const AIDesignContext = createContext<AIDesignContextType>({
  aiDesign: true,
  setAIDesign: () => {},
});

export function AIDesignProvider({ children }: { children: React.ReactNode }) {
  const [aiDesign, setState] = useState<boolean>(() => {
    const saved = localStorage.getItem('crab-ai-design');
    return saved === null ? true : saved === 'true';
  });

  const setAIDesign = useCallback((v: boolean) => {
    setState(v);
    localStorage.setItem('crab-ai-design', String(v));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-ai-design', aiDesign ? 'on' : 'off');
  }, [aiDesign]);

  return (
    <AIDesignContext.Provider value={{ aiDesign, setAIDesign }}>
      {children}
    </AIDesignContext.Provider>
  );
}

export function useAIDesign() {
  return useContext(AIDesignContext);
}
