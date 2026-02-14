import { useState, useRef, useEffect } from 'react';
import { Mail, ArrowRight, Loader2, ArrowLeft, Check, ShieldCheck, Zap, UserCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import type { AuthUser } from '../../hooks/useAuth';

const isDev = import.meta.env.DEV;

type Step = 'email' | 'code' | 'success';

interface LoginPageProps {
  onClose?: () => void;
}

export default function LoginPage({ onClose }: LoginPageProps) {
  const { requestCode, verifyCode, activateSession } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filledCount, setFilledCount] = useState(0);
  const [verifiedUser, setVerifiedUser] = useState<AuthUser | null>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Track filled digit count for progress bar
  useEffect(() => {
    setFilledCount(code.filter(d => d !== '').length);
  }, [code]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await requestCode(email);
      setMessage(res.message);
      setStep('code');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (step === 'success') return;
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];

    // Handle paste of full code
    if (value.length > 1) {
      const digits = value.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (i < 6) newCode[i] = d;
      });
      setCode(newCode);
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      if (digits.length === 6) {
        submitCode(newCode.join(''));
      }
      return;
    }

    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    const full = newCode.join('');
    if (full.length === 6 && newCode.every(d => d !== '')) {
      submitCode(full);
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitCode = async (fullCode: string) => {
    setError('');
    setLoading(true);
    try {
      const user = await verifyCode(email, fullCode);
      setVerifiedUser(user);
      setStep('success');

      // Show success for 1.4s, then fade out, then activate (ProtectedRoute re-renders)
      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          activateSession(user);
        }, 500);
      }, 1400);
    } catch (err) {
      setError((err as Error).message);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (role: 'admin' | 'client') => {
    setError('');
    setLoading(true);
    try {
      const endpoint = role === 'admin' ? '/api/auth/dev-login' : '/api/auth/dev-login-client';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dev login failed');
      activateSession(data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode(['', '', '', '', '', '']);
    setError('');
    setMessage('');
  };

  const isSuccess = step === 'success';

  return (
    <div className={`w-full max-w-md transition-all duration-500 ${fadeOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      {/* Ambient glow behind the card */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-80 h-80 rounded-full blur-[120px] transition-all duration-1000 ${
            isSuccess ? 'bg-green-500/20 scale-125' : 'bg-orange-500/10 scale-100'
          }`}
        />
      </div>

      <div className="relative z-10">
        {/* Card */}
        <div className={`bg-surface border-2 rounded-2xl shadow-2xl shadow-black/50 p-10 transition-all duration-500 relative ${
          isSuccess ? 'border-green-500/40' : 'border-th-border-strong'
        }`}>

          {/* Close button */}
          {onClose && !isSuccess && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors"
            >
              <X size={18} />
            </button>
          )}

          {/* Logo */}
          <div className="text-center mb-8">
            <div className={`text-6xl mb-3 transition-all duration-700 ${isSuccess ? 'scale-110' : ''}`}>
              🦀
            </div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent font-display tracking-tight">
              CrabCreate
            </h1>
            <p className={`text-sm mt-2 transition-colors duration-500 ${isSuccess ? 'text-green-400' : 'text-tx-faint'}`}>
              {isSuccess ? t.authVerified : t.authSubtitle}
            </p>
          </div>

          {/* ── Email step ── */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="animate-[fadeSlideIn_0.3s_ease-out]">
              <label className="block text-sm font-medium text-tx-secondary mb-2">
                {t.authEnterEmail}
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-faint" />
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="nom@exemple.com"
                  required
                  className="w-full bg-subtle border border-th-border-strong rounded-lg pl-10 pr-4 py-3 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)] transition-all"
                />
              </div>

              {error && <p className="mt-3 text-sm text-red-400 animate-[shake_0.4s_ease-in-out]">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email}
                className="mt-5 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 hover:shadow-xl hover:shadow-orange-500/25 shadow-lg shadow-orange-500/20 active:scale-[0.98]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {t.authSendCode}
              </button>

            </form>
          )}

          {/* Dev fast login — outside the form to avoid required validation */}
          {step === 'email' && isDev && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleDevLogin('admin')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium text-amber-400 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all disabled:opacity-40"
              >
                <Zap size={14} />
                Admin
              </button>
              <button
                onClick={() => handleDevLogin('client')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium text-sky-400 border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 transition-all disabled:opacity-40"
              >
                <UserCircle size={14} />
                Client
              </button>
            </div>
          )}

          {/* ── Code step ── */}
          {step === 'code' && (
            <div className="animate-[fadeSlideIn_0.3s_ease-out]">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-tx-faint hover:text-tx-secondary transition-colors mb-4"
              >
                <ArrowLeft size={14} />
                {t.authBackToEmail}
              </button>

              <p className="text-sm text-tx-secondary mb-1">{t.authCodeSentTo}</p>
              <p className="text-sm font-mono text-amber-400 mb-5">{email}</p>

              {message && <p className="text-sm text-tx-faint mb-4">{message}</p>}

              {/* 6-digit code input */}
              <div className="flex gap-2.5 justify-center mb-4">
                {code.map((digit, i) => (
                  <div key={i} className="relative">
                    <input
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={e => handleCodeChange(i, e.target.value)}
                      onKeyDown={e => handleCodeKeyDown(i, e)}
                      disabled={loading}
                      className={`w-12 h-14 bg-subtle border-2 rounded-xl text-center text-xl font-mono font-bold text-tx-primary
                        focus:outline-none transition-all duration-200
                        ${digit
                          ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)] bg-amber-500/5'
                          : 'border-th-border-strong hover:border-th-border'
                        }
                        ${loading ? 'opacity-60' : ''}
                        focus:border-amber-500 focus:shadow-[0_0_20px_rgba(245,158,11,0.2)]`}
                      style={{
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                    {/* Fill indicator dot */}
                    <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-all duration-300 ${
                      digit ? 'bg-amber-500 scale-100' : 'bg-th-border scale-0'
                    }`} />
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="h-0.5 bg-subtle-hover rounded-full mb-5 mt-5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(filledCount / 6) * 100}%` }}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center mb-3 animate-[shake_0.4s_ease-in-out]">{error}</p>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 size={18} className="animate-spin text-amber-400" />
                  <span className="text-sm text-tx-faint">{t.authVerify}...</span>
                </div>
              )}

              <p className="text-xs text-tx-ghost text-center mt-4">{t.authCodeExpiry}</p>
            </div>
          )}

          {/* ── Success step ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-4 animate-[fadeSlideIn_0.4s_ease-out]">
              {/* Animated checkmark */}
              <div className="relative mb-5">
                {/* Ripple rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-2 border-green-500/30 animate-[ripple_1.2s_ease-out_infinite]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-2 border-green-500/20 animate-[ripple_1.2s_ease-out_0.4s_infinite]" />
                </div>

                {/* Check circle */}
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 animate-[scaleIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)]">
                  <Check size={32} className="text-white" strokeWidth={3} />
                </div>
              </div>

              {/* Success text */}
              <div className="flex items-center gap-2 mb-2 animate-[fadeSlideIn_0.5s_ease-out_0.2s_both]">
                <ShieldCheck size={16} className="text-green-400" />
                <span className="text-sm font-semibold text-green-400">{t.authVerified}</span>
              </div>

              <p className="text-xs text-tx-faint animate-[fadeSlideIn_0.5s_ease-out_0.4s_both]">
                {verifiedUser?.email}
              </p>

              {/* Code inputs frozen in green */}
              <div className="flex gap-2.5 justify-center mt-5 animate-[fadeSlideIn_0.5s_ease-out_0.3s_both]">
                {code.map((digit, i) => (
                  <div
                    key={i}
                    className="w-12 h-14 rounded-xl text-center text-xl font-mono font-bold flex items-center justify-center border-2 border-green-500/50 bg-green-500/10 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    {digit}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
