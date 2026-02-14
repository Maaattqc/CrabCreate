import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';

export default function PublicNavbar() {
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: '/', label: t.navHome },
    { to: '/pricing', label: t.navPricing },
    { to: '/contact', label: t.navContact },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-th-border bg-surface backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="brand-emoji text-lg leading-none" aria-hidden="true">🦀</span>
          <span className="text-lg font-extrabold bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent font-display tracking-tight">
            CrabCreate
          </span>
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.to)
                  ? 'text-tx-primary bg-subtle-hover'
                  : 'text-tx-muted hover:text-tx-primary hover:bg-subtle'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Theme + Login */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors"
            title={theme === 'dark' ? t.lightMode : t.darkMode}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link
            to="/login"
            className="hidden md:inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25"
          >
            {t.navLogin}
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-th-border bg-surface backdrop-blur-xl">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'text-tx-primary bg-subtle-hover'
                    : 'text-tx-muted hover:text-tx-primary hover:bg-subtle'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-red-500"
            >
              {t.navLogin}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
