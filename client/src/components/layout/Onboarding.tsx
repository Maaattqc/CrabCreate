import { useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage';

interface OnboardingProps {
  onDone: () => void;
}

export default function Onboarding({ onDone }: OnboardingProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  const steps = [
    { text: t.onboardStep1, icon: '➕' },
    { text: t.onboardStep2, icon: '▶️' },
    { text: t.onboardStep3, icon: '📊' },
    { text: t.onboardStep4, icon: '💬' },
  ];

  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-surface border border-th-border-strong rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header with crab */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="text-5xl mb-4">🦀</div>
          <h2 className="text-xl font-bold text-tx-primary font-display">{t.onboardWelcome}</h2>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 px-8 pb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-gradient-to-r from-amber-500 to-red-500' :
                i < step ? 'w-4 bg-amber-500/40' : 'w-4 bg-subtle-hover'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-8 py-6">
          <div className="flex items-start gap-4 min-h-[80px]">
            <span className="text-3xl shrink-0">{steps[step].icon}</span>
            <div>
              <p className="text-sm text-tx-secondary leading-relaxed">{steps[step].text}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <button
            onClick={onDone}
            className="text-xs text-tx-faint hover:text-tx-tertiary transition-colors"
          >
            {t.onboardSkip}
          </button>
          <button
            onClick={() => isLast ? onDone() : setStep(s => s + 1)}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-red-500 text-white text-sm font-semibold rounded-lg hover:from-amber-400 hover:to-red-400 transition-all shadow-lg shadow-amber-500/20"
          >
            {isLast ? t.onboardGo : t.onboardNext}
          </button>
        </div>
      </div>
    </div>
  );
}
