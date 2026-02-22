import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock useLanguage — hoisted before any other imports by vi.mock
vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({ lang: 'fr', t: {}, setLang: () => {} }),
}));

// Mock SpeechRecognition as a proper class
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  started = false;

  start() {
    this.started = true;
    this.onstart?.();
  }

  stop() {
    this.started = false;
    this.onend?.();
  }

  abort() {
    this.started = false;
  }
}

let mockInstance: MockSpeechRecognition | null = null;

// Install as a constructor class — must use a class/function, NOT vi.fn(() => ...)
// Use Object.defineProperty to make it available before the static import resolves
Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: class extends MockSpeechRecognition {
    constructor() {
      super();
      mockInstance = this;
    }
  },
  writable: true,
  configurable: true,
});

// Now import the hook — getRecognitionCtor() will find webkitSpeechRecognition lazily
import { useSpeechToText } from '../hooks/useSpeechToText';

beforeEach(() => {
  mockInstance = null;
});

describe('useSpeechToText', () => {
  it('reports isSupported=true when webkitSpeechRecognition exists', () => {
    const { result } = renderHook(() => useSpeechToText());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts and stops listening', () => {
    const { result } = renderHook(() => useSpeechToText());

    expect(result.current.isListening).toBe(false);

    act(() => {
      result.current.start();
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isListening).toBe(false);
  });

  it('toggle switches between start and stop', () => {
    const { result } = renderHook(() => useSpeechToText());

    act(() => result.current.toggle());
    expect(result.current.isListening).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isListening).toBe(false);
  });

  it('calls onTranscript with final transcript', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    act(() => result.current.start());

    // Simulate a final result
    act(() => {
      mockInstance?.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: 'bonjour le monde', confidence: 0.95 },
          },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('bonjour le monde', true);
    expect(result.current.transcript).toBe('bonjour le monde');
  });

  it('calls onTranscript with interim transcript', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechToText({ onTranscript }));

    act(() => result.current.start());

    act(() => {
      mockInstance?.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: false,
            length: 1,
            0: { transcript: 'bonjour', confidence: 0.6 },
          },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('bonjour', false);
  });

  it('sets lang based on app language', () => {
    const { result } = renderHook(() => useSpeechToText());
    act(() => result.current.start());
    expect(mockInstance?.lang).toBe('fr-FR');
  });

  it('stops listening on error', () => {
    const { result } = renderHook(() => useSpeechToText());

    act(() => result.current.start());
    expect(result.current.isListening).toBe(true);

    act(() => {
      mockInstance?.onerror?.({ error: 'no-speech', message: 'No speech detected' });
    });
    expect(result.current.isListening).toBe(false);
  });

  it('cleans up on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeechToText());

    act(() => result.current.start());
    expect(mockInstance?.started).toBe(true);

    unmount();
    expect(mockInstance?.started).toBe(false);
  });
});
