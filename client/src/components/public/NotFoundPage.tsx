import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

export default function NotFoundPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-7xl mb-6">🦀</div>
        <h1 className="text-6xl font-extrabold text-tx-primary font-display mb-4">404</h1>
        <h2 className="text-xl font-bold text-tx-secondary mb-3">{t.notFoundTitle}</h2>
        <p className="text-tx-muted mb-8">{t.notFoundDesc}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/20"
        >
          <ArrowLeft size={16} />
          {t.notFoundBack}
        </Link>
      </div>
    </div>
  );
}
