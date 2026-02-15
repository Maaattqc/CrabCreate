import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';

interface Plan {
  name: string;
  price: string;
  perMonth: boolean;
  tickets: string;
  pipelines: string;
  features: string[];
  highlight: boolean;
  planKey: string;
}

interface PlanConfig {
  plan_free_tickets: number;
  plan_free_pipelines: number;
  plan_pro_tickets: number;
  plan_pro_pipelines: number;
  plan_enterprise_tickets: number;
  plan_enterprise_pipelines: number;
}

const DEFAULTS: PlanConfig = {
  plan_free_tickets: 5,
  plan_free_pipelines: 1,
  plan_pro_tickets: 50,
  plan_pro_pipelines: 3,
  plan_enterprise_tickets: -1,
  plan_enterprise_pipelines: 10,
};

export default function PricingPage() {
  const { t } = useLanguage();
  const { user, refreshSession } = useAuth();
  const [searchParams] = useSearchParams();
  const [cfg, setCfg] = useState<PlanConfig>(DEFAULTS);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.ok ? r.json() : DEFAULTS)
      .then(data => setCfg(data))
      .catch(() => {});
  }, []);

  const fmtTickets = (n: number) => n === -1 ? t.settingsUnlimited : String(n);

  const checkoutCanceled = searchParams.get('checkout') === 'canceled';

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage = typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : t.error;

        if (errorMessage === 'Already on Pro plan') {
          await refreshSession().catch(() => {});
          setCheckoutError(t.billingAlreadyOnPro);
        } else {
          setCheckoutError(errorMessage || t.error);
        }
        setCheckoutLoading(false);
        return;
      }

      if ((data as { url?: unknown }).url) {
        try {
          const parsed = new URL((data as { url: string }).url);
          if (['checkout.stripe.com', 'billing.stripe.com'].includes(parsed.hostname)) {
            window.location.href = (data as { url: string }).url;
            return;
          }
        } catch { /* invalid URL */ }
      }
      setCheckoutError(t.error);
      setCheckoutLoading(false);
    } catch {
      setCheckoutLoading(false);
      setCheckoutError(t.error);
    }
  };

  const plans: Plan[] = [
    {
      name: t.pricingFree,
      price: t.pricingFreePrice,
      perMonth: false,
      tickets: `${fmtTickets(cfg.plan_free_tickets)} ${t.pricingFeatureTickets}`,
      pipelines: `${cfg.plan_free_pipelines} ${t.pricingFeaturePipelines}`,
      features: [t.pricingFeatureSupport],
      highlight: false,
      planKey: 'free',
    },
    {
      name: t.pricingPro,
      price: t.pricingProPrice,
      perMonth: true,
      tickets: `${fmtTickets(cfg.plan_pro_tickets)} ${t.pricingFeatureTickets}`,
      pipelines: `${cfg.plan_pro_pipelines} ${t.pricingFeaturePipelines}`,
      features: [t.pricingFeatureSupport, t.pricingFeaturePriority],
      highlight: true,
      planKey: 'pro',
    },
    {
      name: t.pricingEnterprise,
      price: t.pricingEnterprisePrice,
      perMonth: false,
      tickets: `${fmtTickets(cfg.plan_enterprise_tickets)} ${t.pricingFeatureTickets}`,
      pipelines: `${cfg.plan_enterprise_pipelines} ${t.pricingFeaturePipelines}`,
      features: [t.pricingFeatureDedicated, t.pricingFeaturePriority],
      highlight: false,
      planKey: 'enterprise',
    },
  ];

  const renderCTA = (plan: Plan) => {
    const userPlan = user?.plan || 'free';
    const isCurrentPlan = userPlan === plan.planKey;

    // Enterprise always links to contact
    if (plan.planKey === 'enterprise') {
      return (
        <Link
          to="/contact"
          className="w-full text-center py-3 px-4 rounded-lg text-sm font-semibold transition-all text-tx-primary bg-subtle border border-th-border-strong hover:bg-subtle-hover"
        >
          {t.pricingContact}
        </Link>
      );
    }

    // Current plan badge
    if (isCurrentPlan) {
      return (
        <div className="w-full text-center py-3 px-4 rounded-lg text-sm font-semibold bg-subtle border border-th-border-strong text-tx-faint cursor-default">
          {t.billingCurrentPlan}
        </div>
      );
    }

    // Pro plan — not logged in
    if (plan.planKey === 'pro' && !user) {
      return (
        <Link
          to="/login"
          className="w-full text-center py-3 px-4 rounded-lg text-sm font-semibold transition-all text-white bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 shadow-lg shadow-orange-500/20"
        >
          {t.pricingChoose}
        </Link>
      );
    }

    // Pro plan — logged in + free plan
    if (plan.planKey === 'pro' && user && userPlan === 'free') {
      return (
        <button
          onClick={handleCheckout}
          disabled={checkoutLoading}
          className="w-full text-center py-3 px-4 rounded-lg text-sm font-semibold transition-all text-white bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 shadow-lg shadow-orange-500/20 disabled:opacity-50"
        >
          {checkoutLoading ? t.billingLoading : t.billingSubscribe}
        </button>
      );
    }

    // Free plan — not logged in
    if (plan.planKey === 'free' && !user) {
      return (
        <Link
          to="/login"
          className="w-full text-center py-3 px-4 rounded-lg text-sm font-semibold transition-all text-tx-primary bg-subtle border border-th-border-strong hover:bg-subtle-hover"
        >
          {t.pricingChoose}
        </Link>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-24">
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-extrabold text-tx-primary font-display mb-4">
            {t.pricingTitle}
          </h1>
          <p className="text-lg text-tx-muted">{t.pricingSub}</p>
        </div>

        {checkoutCanceled && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400 text-center">
            {t.billingCheckoutCanceled}
          </div>
        )}

        {checkoutError && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400 text-center">
            {checkoutError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`relative bg-card border rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? 'border-amber-500/40 shadow-xl shadow-orange-500/10'
                  : 'border-th-border'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-red-500">
                  Popular
                </div>
              )}

              <h2 className="text-xl font-bold text-tx-primary mb-2">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-extrabold text-tx-primary">{plan.price}</span>
                {plan.perMonth && <span className="text-sm text-tx-muted">{t.pricingPerMonth}</span>}
              </div>

              <div className="flex-1 space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-tx-secondary">
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  {plan.tickets}
                </div>
                <div className="flex items-center gap-2 text-sm text-tx-secondary">
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                  {plan.pipelines}
                </div>
                {plan.features.map(feat => (
                  <div key={feat} className="flex items-center gap-2 text-sm text-tx-secondary">
                    <Check size={16} className="text-green-400 flex-shrink-0" />
                    {feat}
                  </div>
                ))}
              </div>

              {renderCTA(plan)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
