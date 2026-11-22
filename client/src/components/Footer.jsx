import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import { BrandLogo } from './BrandLogo';
import { WhatsAppButton } from './WhatsAppButton';

export function Footer() {
  const { settings } = useSite();

  return (
    <footer className="mt-16 border-t border-[var(--border-gold)] bg-[var(--bg-surface)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <BrandLogo variant="full" className="h-20 sm:h-22" />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">
              Curated luxury car rentals, bridal vehicles, airport transfers,
              and chauffeur-driven tours across Sri Lanka.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 md:items-end">
            <WhatsAppButton
              whatsappNumber={settings.whatsappNumber}
              message={settings.supportGreeting}
              variant="gold"
              size="md"
              dataTestId="footer-whatsapp-btn"
            >
              Chat with Concierge on WhatsApp
            </WhatsAppButton>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
              <a
                href="#fleet"
                className="hover:text-[var(--gold-accent)] transition-colors"
              >
                Fleet
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
                className="inline-flex items-center gap-1 hover:text-[var(--gold-accent)] transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                <span>Staff Admin</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border-subtle)] pt-5 flex flex-col items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] sm:flex-row">
          <span>
            © {new Date().getFullYear()} {settings.companyName}. All rights
            reserved.
          </span>
          <span>Colombo, Sri Lanka · Enquiries handled directly on WhatsApp</span>
        </div>
      </div>
    </footer>
  );
}
