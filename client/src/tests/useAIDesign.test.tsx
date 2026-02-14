import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AIDesignProvider, useAIDesign } from '../hooks/useAIDesign';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AIDesignProvider>{children}</AIDesignProvider>
);

describe('useAIDesign', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-ai-design');
  });

  it('defaults to true', () => {
    const { result } = renderHook(() => useAIDesign(), { wrapper });
    expect(result.current.aiDesign).toBe(true);
  });

  it('sets data-ai-design attribute on documentElement to "on"', () => {
    renderHook(() => useAIDesign(), { wrapper });
    expect(document.documentElement.getAttribute('data-ai-design')).toBe('on');
  });

  it('setAIDesign(false) sets attribute to "off"', () => {
    const { result } = renderHook(() => useAIDesign(), { wrapper });

    act(() => {
      result.current.setAIDesign(false);
    });

    expect(result.current.aiDesign).toBe(false);
    expect(document.documentElement.getAttribute('data-ai-design')).toBe('off');
  });

  it('persists aiDesign to localStorage', () => {
    const { result } = renderHook(() => useAIDesign(), { wrapper });

    act(() => {
      result.current.setAIDesign(false);
    });

    expect(localStorage.getItem('crab-ai-design')).toBe('false');
  });

  it('reads aiDesign from localStorage on init', () => {
    localStorage.setItem('crab-ai-design', 'false');
    const { result } = renderHook(() => useAIDesign(), { wrapper });
    expect(result.current.aiDesign).toBe(false);
  });
});
