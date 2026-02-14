import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AnimationsProvider, useAnimations } from '../hooks/useAnimations';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AnimationsProvider>{children}</AnimationsProvider>
);

describe('useAnimations', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-animations');
  });

  it('defaults to true', () => {
    const { result } = renderHook(() => useAnimations(), { wrapper });
    expect(result.current.animations).toBe(true);
  });

  it('sets data-animations attribute on documentElement to "on"', () => {
    renderHook(() => useAnimations(), { wrapper });
    expect(document.documentElement.getAttribute('data-animations')).toBe('on');
  });

  it('setAnimations(false) sets attribute to "off"', () => {
    const { result } = renderHook(() => useAnimations(), { wrapper });

    act(() => {
      result.current.setAnimations(false);
    });

    expect(result.current.animations).toBe(false);
    expect(document.documentElement.getAttribute('data-animations')).toBe('off');
  });

  it('persists animations to localStorage', () => {
    const { result } = renderHook(() => useAnimations(), { wrapper });

    act(() => {
      result.current.setAnimations(false);
    });

    expect(localStorage.getItem('crab-animations')).toBe('false');
  });

  it('reads animations from localStorage on init', () => {
    localStorage.setItem('crab-animations', 'false');
    const { result } = renderHook(() => useAnimations(), { wrapper });
    expect(result.current.animations).toBe(false);
  });
});
