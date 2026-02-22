import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Hoist mock state so it's available in vi.mock factory ─────────
const { mockToggle, mockReturnValue } = vi.hoisted(() => {
  const mockToggle = vi.fn();
  const defaultReturn = {
    isListening: false,
    isSupported: true,
    transcript: '',
    start: vi.fn(),
    stop: vi.fn(),
    toggle: mockToggle,
  };
  let current = { ...defaultReturn };
  return {
    mockToggle,
    mockReturnValue: {
      get: () => current,
      set: (v: typeof defaultReturn) => { current = v; },
      reset: () => { current = { ...defaultReturn, toggle: mockToggle }; },
    },
  };
});

vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: () => mockReturnValue.get(),
}));

// ── Mock useLanguage ──────────────────────────────────────────────
vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    lang: 'fr',
    t: {
      micStart: 'Dictee vocale',
      micStop: 'Arreter la dictee',
    },
    setLang: () => {},
  }),
}));

import MicButton from '../components/common/MicButton';
import VoiceInput from '../components/common/VoiceInput';
import VoiceTextarea from '../components/common/VoiceTextarea';

beforeEach(() => {
  vi.clearAllMocks();
  mockReturnValue.reset();
});

describe('MicButton', () => {
  it('renders when isSupported is true', () => {
    render(<MicButton isListening={false} isSupported={true} onClick={vi.fn()} />);
    expect(screen.getByTitle('Dictee vocale')).toBeDefined();
  });

  it('does not render when isSupported is false', () => {
    const { container } = render(<MicButton isListening={false} isSupported={false} onClick={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows stop title when listening', () => {
    render(<MicButton isListening={true} isSupported={true} onClick={vi.fn()} />);
    expect(screen.getByTitle('Arreter la dictee')).toBeDefined();
  });

  it('applies recording styles when listening', () => {
    render(<MicButton isListening={true} isSupported={true} onClick={vi.fn()} />);
    const btn = screen.getByTitle('Arreter la dictee');
    expect(btn.className).toContain('text-red-400');
    expect(btn.className).toContain('mic-recording');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<MicButton isListening={false} isSupported={true} onClick={onClick} />);
    fireEvent.click(screen.getByTitle('Dictee vocale'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('VoiceInput', () => {
  it('renders input with all passed props', () => {
    render(
      <VoiceInput
        placeholder="Type here"
        maxLength={100}
        value="hello"
        onChange={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement;
    expect(input.value).toBe('hello');
    expect(input.maxLength).toBe(100);
  });

  it('renders mic button when supported', () => {
    render(<VoiceInput value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Dictee vocale')).toBeDefined();
  });

  it('hides mic button when not supported', () => {
    mockReturnValue.set({
      isListening: false,
      isSupported: false,
      transcript: '',
      start: vi.fn(),
      stop: vi.fn(),
      toggle: mockToggle,
    });
    const { container } = render(<VoiceInput value="" onChange={vi.fn()} />);
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('calls onChange on user input', () => {
    const onChange = vi.fn();
    render(<VoiceInput value="" onChange={onChange} placeholder="test" />);
    fireEvent.change(screen.getByPlaceholderText('test'), { target: { value: 'new text' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('VoiceTextarea', () => {
  it('renders textarea with all passed props', () => {
    render(
      <VoiceTextarea
        placeholder="Description"
        rows={5}
        value="content"
        onChange={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Description') as HTMLTextAreaElement;
    expect(textarea.value).toBe('content');
    expect(textarea.rows).toBe(5);
  });

  it('renders mic button when supported', () => {
    render(<VoiceTextarea value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Dictee vocale')).toBeDefined();
  });

  it('applies containerClassName', () => {
    const { container } = render(
      <VoiceTextarea value="" onChange={vi.fn()} containerClassName="flex-1" />
    );
    expect(container.firstElementChild?.className).toContain('flex-1');
  });
});
