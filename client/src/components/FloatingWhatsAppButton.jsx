import { useSite } from '../context/SiteContext';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { WhatsAppIcon } from './WhatsAppButton';

/**
 * Mobile-only floating WhatsApp Support button pinned to the bottom-right corner.
 * Uses the centralized WhatsApp number from SiteContext and automatically disables
 * until a valid number is saved in the Staff Admin Dashboard.
 */
export function FloatingWhatsAppButton() {
  const { settings } = useSite();
  const url = buildWhatsAppUrl(settings.whatsappNumber, settings.supportGreeting);
  const isDisabled = !url;

  const baseClass =
    'fixed bottom-5 right-4 z-40 md:hidden inline-flex h-13 w-13 items-center justify-center rounded-full shadow-[0_12px_28px_-6px_rgba(0,0,0,0.65)] ring-1 ring-[#F3DC96]/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] transition-transform active:scale-95';

  if (isDisabled) {
    const disabledReason =
      'WhatsApp support is unavailable until a valid WhatsApp number is configured in Admin.';
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={disabledReason}
        title={disabledReason}
        data-testid="floating-whatsapp-btn"
        className={`btn-gold ${baseClass}`}
      >
        <WhatsAppIcon className="h-6 w-6" />
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp Support"
      title="Chat with Colombo Tours on WhatsApp"
      data-testid="floating-whatsapp-btn"
      className={`btn-gold ${baseClass}`}
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}
