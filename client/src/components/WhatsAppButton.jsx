import { useOptionalSite } from '../context/SiteContext';
import { resolveWhatsAppUrl } from '../lib/channels';

export function WhatsAppIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.33-1.66a11.86 11.86 0 0 0 5.73 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.44-8.42ZM12.07 21.8h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.66-.24-.37a9.88 9.88 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.82 9.82 0 0 1 2.89 7c0 5.46-4.44 9.89-9.89 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Centralized WhatsApp enquiry button.
 * Automatically disables when the configured WhatsApp number is missing or invalid,
 * or when caller passes `disabled={true}` (e.g. invalid Quick Enquiry dates).
 */
export function WhatsAppButton({
  whatsappNumber,
  whatsappLink,
  whatsappMode,
  whatsappEnabled,
  message,
  children,
  variant = 'gold',
  size = 'md',
  disabled = false,
  className = '',
  ariaLabel,
  onClick,
  showIcon = true,
  dataTestId,
}) {
  const site = useOptionalSite();
  const s = site?.settings;
  const url = resolveWhatsAppUrl({
    whatsappNumber:
      whatsappNumber !== undefined ? whatsappNumber : s?.whatsappNumber || '',
    whatsappLink:
      whatsappLink !== undefined ? whatsappLink : s?.whatsappLink || '',
    whatsappMode:
      whatsappMode !== undefined ? whatsappMode : s?.whatsappMode || 'number',
    whatsappEnabled:
      whatsappEnabled !== undefined
        ? whatsappEnabled
        : s?.whatsappEnabled !== false,
    message,
  });
  const isDisabled = disabled || !url;

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-sm sm:text-base gap-2',
  };

  const variantStyles = {
    gold: 'btn-gold rounded-full',
    outline:
      'rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] transition-colors',
  };

  const baseClass = `inline-flex items-center justify-center font-medium leading-none select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-bright)] ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.gold} ${className}`;

  if (isDisabled) {
    const disabledReason = !url
      ? 'WhatsApp enquiry is unavailable until a valid WhatsApp number is configured in Admin.'
      : 'Please correct the form details before sending your WhatsApp enquiry.';
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={ariaLabel || disabledReason}
        title={disabledReason}
        data-testid={dataTestId}
        className={`${baseClass} ${
          variant === 'outline'
            ? 'opacity-55 cursor-not-allowed hover:bg-[var(--bg-pill)] hover:border-[var(--border-gold)]'
            : ''
        }`}
      >
        {showIcon ? <WhatsAppIcon className="w-4 h-4 shrink-0" /> : null}
        <span>{children}</span>
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={onClick}
      data-testid={dataTestId}
      className={baseClass}
    >
      {showIcon ? <WhatsAppIcon className="w-4 h-4 shrink-0" /> : null}
      <span>{children}</span>
    </a>
  );
}
