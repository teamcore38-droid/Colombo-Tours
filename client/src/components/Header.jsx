import { Menu, Moon, ShieldCheck, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { useTheme } from '../context/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { WhatsAppButton } from './WhatsAppButton';

export function Header() {
  const { isDark, toggleTheme } = useTheme();
  const { settings } = useSite();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border-gold)] bg-[var(--bg-surface)]/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:h-[72px] lg:px-8">
          {/* Left: Mobile hamburger + Brand logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to="/"
              className="shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--gold-bright)] rounded-lg"
            >
              <BrandLogo variant="compact" />
            </Link>
          </div>

          {/* Center: Desktop minimal navigation */}
          <nav
            aria-label="Primary"
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-[var(--text-secondary)]"
          >
            <a
              href="#fleet"
              className="hover:text-[var(--gold-accent)] transition-colors"
            >
              Premium Fleet
            </a>
            <a
              href="#services"
              className="hover:text-[var(--gold-accent)] transition-colors"
            >
              Services
            </a>
            <a
              href="#quick-enquiry"
              className="hover:text-[var(--gold-accent)] transition-colors"
            >
              Quick Enquiry
            </a>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 hover:text-[var(--gold-accent)] transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
              <span>Admin</span>
            </Link>
          </nav>

          {/* Right: WhatsApp Support pill + compact Sun/Moon segmented toggle */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <WhatsAppButton
              whatsappNumber={settings.whatsappNumber}
              message={settings.supportGreeting}
              variant="outline"
              size="sm"
              dataTestId="header-whatsapp-btn"
              className="px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium"
            >
              <span className="hidden xs:inline sm:inline">WhatsApp Support</span>
              <span className="xs:hidden sm:hidden">WhatsApp</span>
            </WhatsAppButton>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                isDark ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="theme-toggle"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] p-1 transition-colors hover:border-[var(--border-gold-strong)]"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                  isDark
                    ? 'bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
              </span>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                  !isDark
                    ? 'bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-over navigation drawer */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 flex w-72 max-w-[82vw] flex-col border-r border-[var(--border-gold)] bg-[var(--bg-surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <BrandLogo variant="compact" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--gold-soft-bg)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-5 flex flex-col gap-1.5 text-sm font-medium">
              <a
                href="#fleet"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] hover:text-[var(--gold-accent)]"
              >
                Browse Fleet
              </a>
              <a
                href="#quick-enquiry"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] hover:text-[var(--gold-accent)]"
              >
                Quick Enquiry
              </a>
              <a
                href="#services"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] hover:text-[var(--gold-accent)]"
              >
                Chauffeur &amp; Wedding Services
              </a>
              <Link
                to="/admin"
                onClick={() => setDrawerOpen(false)}
                className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border-gold)] px-3.5 py-2.5 text-[var(--gold-accent)] hover:bg-[var(--gold-soft-bg)]"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Staff Admin Dashboard</span>
              </Link>
            </nav>

            <div className="mt-auto pt-5 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                {settings.tagline}
              </p>
              <WhatsAppButton
                whatsappNumber={settings.whatsappNumber}
                message={settings.supportGreeting}
                variant="gold"
                size="md"
                className="w-full"
              >
                WhatsApp Support
              </WhatsAppButton>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
