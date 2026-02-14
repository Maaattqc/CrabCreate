import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../hooks/useNotifications';

describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('starts with empty notifications', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.notifications).toEqual([]);
  });

  it('adds a notification', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification('Test message', 'info');
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].message).toBe('Test message');
    expect(result.current.notifications[0].type).toBe('info');
  });

  it('defaults to info type', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification('No type');
    });

    expect(result.current.notifications[0].type).toBe('info');
  });

  it('removes a notification manually', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification('To remove', 'error');
    });

    const id = result.current.notifications[0].id;

    act(() => {
      result.current.removeNotification(id);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('auto-dismisses after 5 seconds', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification('Auto dismiss', 'success');
    });

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('handles multiple notifications', () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification('First', 'info');
      result.current.addNotification('Second', 'error');
      result.current.addNotification('Third', 'warning');
    });

    expect(result.current.notifications).toHaveLength(3);
  });
});
