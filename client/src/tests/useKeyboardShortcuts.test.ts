import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pressing "n" calls onNewTicket', () => {
    const onNewTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewTicket }));

    fireEvent.keyDown(window, { key: 'n' });
    expect(onNewTicket).toHaveBeenCalledTimes(1);
  });

  it('pressing "j" calls onNextTicket', () => {
    const onNextTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNextTicket }));

    fireEvent.keyDown(window, { key: 'j' });
    expect(onNextTicket).toHaveBeenCalledTimes(1);
  });

  it('pressing "k" calls onPrevTicket', () => {
    const onPrevTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onPrevTicket }));

    fireEvent.keyDown(window, { key: 'k' });
    expect(onPrevTicket).toHaveBeenCalledTimes(1);
  });

  it('pressing "f" calls onToggleFavorite', () => {
    const onToggleFavorite = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onToggleFavorite }));

    fireEvent.keyDown(window, { key: 'f' });
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('pressing "/" calls onSearch', () => {
    const onSearch = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSearch }));

    fireEvent.keyDown(window, { key: '/' });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('pressing "?" calls onShowShortcuts', () => {
    const onShowShortcuts = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onShowShortcuts }));

    fireEvent.keyDown(window, { key: '?' });
    expect(onShowShortcuts).toHaveBeenCalledTimes(1);
  });

  it('does not fire when focused on INPUT element', () => {
    const onNewTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewTicket }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Dispatch on the input element so e.target is the input; event bubbles to window
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(onNewTicket).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does not fire when focused on TEXTAREA element', () => {
    const onNewTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewTicket }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(onNewTicket).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('does not fire when focused on contentEditable element', () => {
    const onNewTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewTicket }));

    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    // jsdom may not properly set isContentEditable, so we ensure it via defineProperty
    Object.defineProperty(div, 'isContentEditable', { value: true, writable: false });

    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(onNewTicket).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it('cleanup removes event listener on unmount', () => {
    const onNewTicket = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onNewTicket }));

    unmount();

    fireEvent.keyDown(window, { key: 'n' });
    expect(onNewTicket).not.toHaveBeenCalled();
  });

  it('does not fire when enabled is false', () => {
    const onNewTicket = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewTicket }, false));

    fireEvent.keyDown(window, { key: 'n' });
    expect(onNewTicket).not.toHaveBeenCalled();
  });

  it('does not crash when callback is not provided', () => {
    renderHook(() => useKeyboardShortcuts({}));

    // Should not throw
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: '/' });
  });
});
