import { useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export default function ContactPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const _base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${_base}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          throw new Error(data.details.map((d: { message: string }) => d.message).join('. '));
        }
        throw new Error(data.error || 'Failed');
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-tx-primary mb-2">{t.contactSuccess}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-lg mx-auto px-6 pt-20 pb-24">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-tx-primary font-display mb-3">{t.contactTitle}</h1>
          <p className="text-tx-muted">{t.contactSub}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-th-border rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1.5">{t.contactName}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
              maxLength={200}
              className="w-full bg-subtle border border-th-border-strong rounded-lg px-4 py-3 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 transition-all"
            />
            <span className="text-[11px] text-tx-faint mt-1 block">{t.validationContactNameHint}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1.5">{t.contactEmail}</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              required
              maxLength={255}
              className="w-full bg-subtle border border-th-border-strong rounded-lg px-4 py-3 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 transition-all"
            />
            <span className="text-[11px] text-tx-faint mt-1 block">{t.validationContactEmailHint}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1.5">{t.contactMessage}</label>
            <textarea
              value={form.message}
              onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              required
              rows={5}
              maxLength={5000}
              className="w-full bg-subtle border border-th-border-strong rounded-lg px-4 py-3 text-sm text-tx-primary placeholder-tx-faint focus:outline-none focus:border-amber-500/50 transition-all resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-tx-faint">{t.validationContactMsgHint}</span>
              {form.message.length > 100 && (
                <span className={`text-[11px] ${form.message.length > 4500 ? 'text-amber-400' : 'text-tx-faint'}`}>
                  {5000 - form.message.length} {t.validationCharsRemaining}
                </span>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> {t.contactSending}</>
            ) : (
              <><Send size={16} /> {t.contactSend}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
