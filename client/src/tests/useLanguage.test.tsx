import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../hooks/useLanguage';
import { translations } from '../i18n';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe('useLanguage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to fr language', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.lang).toBe('fr');
  });

  it('t object has French translations by default', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.t).toEqual(translations.fr);
  });

  it('setLang switches to English', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLang('en');
    });

    expect(result.current.lang).toBe('en');
    expect(result.current.t).toEqual(translations.en);
  });

  it('persists language to localStorage', () => {
    const { result } = renderHook(() => useLanguage(), { wrapper });

    act(() => {
      result.current.setLang('en');
    });

    expect(localStorage.getItem('crab-lang')).toBe('en');
  });

  it('reads language from localStorage on init', () => {
    localStorage.setItem('crab-lang', 'en');
    const { result } = renderHook(() => useLanguage(), { wrapper });
    expect(result.current.lang).toBe('en');
    expect(result.current.t).toEqual(translations.en);
  });
});
