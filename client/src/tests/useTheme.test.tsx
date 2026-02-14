import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../hooks/useTheme';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark theme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
  });

  it('sets data-theme attribute on document', () => {
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles between dark and light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => {
      result.current.toggle();
    });

    expect(result.current.theme).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggle();
    });

    expect(localStorage.getItem('crab-theme')).toBe('light');
  });

  it('reads theme from localStorage', () => {
    localStorage.setItem('crab-theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });
});
