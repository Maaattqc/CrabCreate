import { createContext, useContext, useState, useCallback } from 'react';
import { translations, type Lang, type Translations } from '../i18n';

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'fr',
  setLang: () => {},
  t: translations.fr,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('crab-lang');
    return (saved === 'en' || saved === 'fr') ? saved : 'fr';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('crab-lang', l);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
