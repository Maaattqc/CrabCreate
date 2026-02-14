import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Onboarding from '../components/layout/Onboarding';
import { LanguageProvider } from '../hooks/useLanguage';

const wrapper = ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>;

describe('Onboarding', () => {
  it('renders the welcome text', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />, { wrapper });

    // The French welcome text includes the crab emoji and 'Bienvenue'
    // Multiple elements may match (the standalone emoji div + the heading), so use getAllByText
    const matches = screen.getAllByText(/🦀|Bienvenue|Welcome/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('advances steps when clicking "Suivant"/"Next"', () => {
    const onDone = vi.fn();
    const { container } = render(<Onboarding onDone={onDone} />, { wrapper });

    // Step indicators are rendered as small divs; the active one has a wider width class (w-8)
    const getActiveIndicator = () =>
      container.querySelector('.w-8.bg-gradient-to-r');

    // Initially step 0 is active — the first indicator should have the active class
    const indicators = container.querySelectorAll('.rounded-full');
    expect(indicators.length).toBe(4);
    expect(getActiveIndicator()).toBeTruthy();

    // Click "Suivant" (Next) to advance to step 1
    const nextButton = screen.getByText(/Suivant|Next/);
    fireEvent.click(nextButton);

    // After advancing, the active indicator should still exist (now on step 1)
    expect(getActiveIndicator()).toBeTruthy();

    // The previously active indicator (step 0) should now have the completed style
    const completedIndicators = container.querySelectorAll('.w-4.bg-amber-500\\/40');
    expect(completedIndicators.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onDone when clicking the last step button', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />, { wrapper });

    const nextButton = screen.getByText(/Suivant|Next/);

    // Advance through all 4 steps (0 -> 1 -> 2 -> 3)
    fireEvent.click(nextButton); // step 0 -> 1
    fireEvent.click(nextButton); // step 1 -> 2
    fireEvent.click(nextButton); // step 2 -> 3 (last step)

    // On the last step the button text changes to "C'est parti !" or "Let's go!"
    const goButton = screen.getByText(/C'est parti|Let's go/);
    fireEvent.click(goButton);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone when clicking "Passer"/"Skip"', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />, { wrapper });

    const skipButton = screen.getByText(/Passer|Skip/);
    fireEvent.click(skipButton);

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
