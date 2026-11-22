import { Briefcase, Car, Compass, Heart, Plane } from 'lucide-react';
import { buildServiceEnquiryMessage } from '../lib/whatsapp';
import { WhatsAppButton } from './WhatsAppButton';

const ICON_MAP = {
  plane: Plane,
  heart: Heart,
  compass: Compass,
  briefcase: Briefcase,
  car: Car,
};

export function ServicesSection({ services = [], whatsappNumber }) {
  if (!services.length) return null;

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="mt-12 sm:mt-16"
    >
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gold-accent)]">
            Tailored Sri Lankan Hospitality
          </p>
          <h2
            id="services-heading"
            className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]"
          >
            Bespoke Chauffeur &amp; Transfer Services
          </h2>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-[var(--text-muted)]">
          Select any service below to message our concierge directly on WhatsApp
          with your itinerary.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = ICON_MAP[service.icon] || Car;
          const label = service.whatsappLabel || service.name;
          const message = buildServiceEnquiryMessage(label);

          return (
            <article
              key={service._id || service.slug}
              data-testid={`service-card-${service.slug}`}
              className="card-luxury flex flex-col rounded-2xl p-5"
            >
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                {service.badge ? (
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-pill)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    {service.badge}
                  </span>
                ) : null}
              </div>

              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {service.name}
              </h3>

              {service.description ? (
                <p className="mt-2 mb-5 text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
                  {service.description}
                </p>
              ) : null}

              <div className="mt-auto">
                <WhatsAppButton
                  whatsappNumber={whatsappNumber}
                  message={message}
                  variant="outline"
                  size="sm"
                  dataTestId={`service-whatsapp-${service.slug}`}
                  className="w-full py-2.5 text-xs font-semibold"
                >
                  Enquire via WhatsApp
                </WhatsAppButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
