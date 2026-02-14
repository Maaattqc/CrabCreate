import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Onboarding from '../components/layout/Onboarding';
import { LanguageProvider } from '../hooks/useLanguage';

const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;

function renderOnboarding(overrides?: {
  onDone?: () => void;
  onCreateDemoTicket?: () => Promise<number>;
  onSimulatePipeline?: (id: number, onStep: (status: string) => void, onComplete: () => void) => void;
}) {
  const onDone = overrides?.onDone ?? vi.fn();
  const onCreateDemoTicket = overrides?.onCreateDemoTicket ?? vi.fn<() => Promise<number>>().mockResolvedValue(42);
  const onSimulatePipeline = overrides?.onSimulatePipeline ?? vi.fn<(id: number, onStep: (status: string) => void, cb: () => void) => void>().mockImplementation((_id, _onStep, cb) => { setTimeout(cb, 100); });
  const result = render(
    <Onboarding onDone={onDone} onCreateDemoTicket={onCreateDemoTicket} onSimulatePipeline={onSimulatePipeline} />,
    { wrapper },
  );
  return { ...result, onDone, onCreateDemoTicket, onSimulatePipeline };
}

// Mock getBoundingClientRect for data-onboard elements
beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100, left: 200, right: 240, bottom: 140,
    width: 40, height: 40, x: 200, y: 100,
  });
});

describe('Onboarding', () => {
  it('renders step 1 text and progress indicator', () => {
    renderOnboarding();
    expect(screen.getByText(/Créez un ticket|Create a ticket/)).toBeTruthy();
    expect(screen.getByText(/1\/3/)).toBeTruthy();
  });

  it('clicking Suivant at step 0 starts cursor animation', async () => {
    vi.useFakeTimers();
    renderOnboarding();

    const nextButton = screen.getByText(/Suivant|Next/);
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // The "Suivant" button should disappear (phase is no longer 'idle')
    expect(screen.queryByText(/Suivant|Next/)).toBeNull();

    vi.useRealTimers();
  });

  it('shows quick tour subtitle', () => {
    renderOnboarding();
    expect(screen.getByText(/Tutoriel rapide|Quick tour/)).toBeTruthy();
  });

  it('clicking backdrop does NOT dismiss onboarding', () => {
    const onDone = vi.fn();
    const { container } = renderOnboarding({ onDone });

    const backdrop = container.querySelector('.bg-black\\/60');
    if (backdrop) fireEvent.click(backdrop);

    expect(onDone).not.toHaveBeenCalled();
  });
});
