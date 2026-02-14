import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-th-border bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="brand-emoji text-lg leading-none" aria-hidden="true">🦀</span>
            <span className="text-lg font-extrabold bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent font-display">
              CrabCreate
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-6 text-sm text-tx-muted">
            <Link to="/" className="hover:text-tx-primary transition-colors">{t.navHome}</Link>
            <Link to="/pricing" className="hover:text-tx-primary transition-colors">{t.navPricing}</Link>
            <Link to="/contact" className="hover:text-tx-primary transition-colors">{t.navContact}</Link>
            <Link to="/legal" className="hover:text-tx-primary transition-colors">{t.footerLegal}</Link>
            <Link to="/privacy" className="hover:text-tx-primary transition-colors">{t.footerPrivacy}</Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-th-border text-center text-xs text-tx-ghost">
          {t.footerRights}
        </div>
      </div>
    </footer>
  );
}
