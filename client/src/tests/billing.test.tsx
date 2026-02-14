import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useLanguage with FR translations
vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    lang: 'fr',
    t: {
      pricingTitle: 'Tarifs',
      pricingSub: 'Choisissez votre plan',
      pricingFree: 'Free',
      pricingFreePrice: '0€',
      pricingPro: 'Pro',
      pricingProPrice: '49€',
      pricingEnterprise: 'Enterprise',
      pricingEnterprisePrice: 'Sur mesure',
      pricingPerMonth: '/mois',
      pricingChoose: 'Choisir',
      pricingContact: 'Contactez-nous',
      pricingFeatureTickets: 'tickets/mois',
      pricingFeaturePipelines: 'pipelines simultanés',
      pricingFeatureSupport: 'Support',
      pricingFeaturePriority: 'Priorité',
      pricingFeatureDedicated: 'Dédié',
      billingCurrentPlan: 'Plan actuel',
      billingSubscribe: "S'abonner",
      billingLoading: 'Chargement...',
      billingCheckoutCanceled: 'Paiement annulé',
      settingsUnlimited: 'Illimité',
    },
    setLang: vi.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function wrapperWithParams(search: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/pricing${search}`]}>{children}</MemoryRouter>
  );
}

// Lazy import to allow mocks to be set up first
let PricingPage: typeof import('../components/public/PricingPage').default;

beforeEach(async () => {
  vi.clearAllMocks();
  // Mock /api/plans fetch
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      plan_free_tickets: 5,
      plan_free_pipelines: 1,
      plan_pro_tickets: 50,
      plan_pro_pipelines: 3,
      plan_enterprise_tickets: -1,
      plan_enterprise_pipelines: 10,
    }),
  } as Response);

  // Dynamic import to pick up mocks
  const mod = await import('../components/public/PricingPage');
  PricingPage = mod.default;
});

describe('PricingPage', () => {
  it('renders pricing title and 3 plans', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<PricingPage />, { wrapper });

    expect(screen.getByText('Tarifs')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('shows "Choisir" link for Pro when not logged in', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<PricingPage />, { wrapper });

    const chooseButtons = screen.getAllByText('Choisir');
    expect(chooseButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Plan actuel" badge when user is on free plan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', plan: 'free', isAdmin: false, stripeSubscriptionStatus: null, preferences: {} },
      loading: false,
    });
    render(<PricingPage />, { wrapper });

    expect(screen.getByText('Plan actuel')).toBeInTheDocument();
  });

  it('shows Subscribe button for free user on Pro plan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', plan: 'free', isAdmin: false, stripeSubscriptionStatus: null, preferences: {} },
      loading: false,
    });
    render(<PricingPage />, { wrapper });

    expect(screen.getByText("S'abonner")).toBeInTheDocument();
  });

  it('shows "Plan actuel" for pro user on Pro plan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', plan: 'pro', isAdmin: false, stripeSubscriptionStatus: 'active', preferences: {} },
      loading: false,
    });
    render(<PricingPage />, { wrapper });

    const badges = screen.getAllByText('Plan actuel');
    expect(badges).toHaveLength(1);
  });

  it('calls /api/billing/checkout when Subscribe button is clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', plan: 'free', isAdmin: false, stripeSubscriptionStatus: null, preferences: {} },
      loading: false,
    });

    // First call = /api/plans, second call = /api/billing/checkout
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan_free_tickets: 5, plan_free_pipelines: 1,
          plan_pro_tickets: 50, plan_pro_pipelines: 3,
          plan_enterprise_tickets: -1, plan_enterprise_pipelines: 10,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://checkout.stripe.com/session' }),
      } as Response);

    render(<PricingPage />, { wrapper });

    const subscribeBtn = screen.getByText("S'abonner");
    fireEvent.click(subscribeBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }));
    });
  });

  it('shows canceled banner when checkout=canceled in URL', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<PricingPage />, { wrapper: wrapperWithParams('?checkout=canceled') });

    expect(screen.getByText('Paiement annulé')).toBeInTheDocument();
  });

  it('does not show canceled banner when no query param', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<PricingPage />, { wrapper });

    expect(screen.queryByText('Paiement annulé')).not.toBeInTheDocument();
  });

  it('shows loading text when checkout is in progress', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', plan: 'free', isAdmin: false, stripeSubscriptionStatus: null, preferences: {} },
      loading: false,
    });

    // Plans fetch resolves, checkout fetch hangs
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan_free_tickets: 5, plan_free_pipelines: 1,
          plan_pro_tickets: 50, plan_pro_pipelines: 3,
          plan_enterprise_tickets: -1, plan_enterprise_pipelines: 10,
        }),
      } as Response)
      .mockReturnValueOnce(new Promise(() => {})); // hang

    render(<PricingPage />, { wrapper });

    const subscribeBtn = screen.getByText("S'abonner");
    fireEvent.click(subscribeBtn);

    await waitFor(() => {
      expect(screen.getByText('Chargement...')).toBeInTheDocument();
    });
  });

  it('always shows "Contactez-nous" for Enterprise plan', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@example.com', plan: 'pro', isAdmin: false, stripeSubscriptionStatus: 'active', preferences: {} },
      loading: false,
    });
    render(<PricingPage />, { wrapper });

    expect(screen.getByText('Contactez-nous')).toBeInTheDocument();
  });
});
